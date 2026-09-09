package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"nhooyr.io/websocket"
)

var socketCounter uint64 = 1000

// GenerateSocketID returns a Pusher-compliant socket ID "integer.random"
func GenerateSocketID() string {
	id := atomic.AddUint64(&socketCounter, 1)
	randomPart := rand.Intn(900000000) + 100000000
	return fmt.Sprintf("%d.%d", id, randomPart)
}

type PusherMessage struct {
	Event   string      `json:"event"`
	Channel string      `json:"channel,omitempty"`
	Data    interface{} `json:"data"`
}

type SubscribePayload struct {
	Channel     string `json:"channel"`
	Auth        string `json:"auth,omitempty"`
	ChannelData string `json:"channel_data,omitempty"`
}

type Client struct {
	hub           *Hub
	conn          *websocket.Conn
	socketID      string
	appID         string
	appKey        string
	channels      map[string]bool
	userID        string
	sendCh        chan []byte
	ctx           context.Context
	cancel        context.CancelFunc
	mu            sync.RWMutex
	lastPing      time.Time
	authenticated bool
}

func NewClient(hub *Hub, conn *websocket.Conn, appID, appKey string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		hub:      hub,
		conn:     conn,
		socketID: GenerateSocketID(),
		appID:    appID,
		appKey:   appKey,
		channels: make(map[string]bool),
		sendCh:   make(chan []byte, 256),
		ctx:      ctx,
		cancel:   cancel,
		lastPing: time.Now(),
	}
}

func (c *Client) Send(msg []byte) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	select {
	case c.sendCh <- msg:
	default:
		// Queue full, drop or close
	}
}

func (c *Client) SendPusher(event, channel string, data interface{}) error {
	var encodedData interface{} = data
	// Pusher protocol stringifies data for internal events
	switch v := data.(type) {
	case string:
		encodedData = v
	case []byte:
		encodedData = string(v)
	default:
		bytes, err := json.Marshal(data)
		if err == nil {
			encodedData = string(bytes)
		}
	}

	msg := PusherMessage{
		Event:   event,
		Channel: channel,
		Data:    encodedData,
	}

	bytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	c.Send(bytes)
	return nil
}

func (c *Client) SendError(message string, code int) {
	errPayload := map[string]interface{}{
		"message": message,
		"code":    code,
	}
	_ = c.SendPusher("pusher:error", "", errPayload)
}

func (c *Client) Close() {
	c.cancel()
	_ = c.conn.Close(websocket.StatusNormalClosure, "disconnecting")
}

func (c *Client) WritePump() {
	defer c.Close()
	for {
		select {
		case <-c.ctx.Done():
			return
		case msg, ok := <-c.sendCh:
			if !ok {
				return
			}
			ctx, cancel := context.WithTimeout(c.ctx, 5*time.Second)
			err := c.conn.Write(ctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func (c *Client) ReadPump(activityTimeout time.Duration) {
	defer func() {
		c.hub.Unregister(c)
		c.Close()
	}()

	for {
		// Read next message with activity timeout
		readCtx, cancel := context.WithTimeout(c.ctx, activityTimeout)
		msgType, data, err := c.conn.Read(readCtx)
		cancel()

		if err != nil {
			return
		}

		if msgType != websocket.MessageText {
			continue
		}

		c.lastPing = time.Now()
		var rawMsg map[string]json.RawMessage
		if err := json.Unmarshal(data, &rawMsg); err != nil {
			c.SendError("Invalid message format", 4000)
			continue
		}

		var event string
		if e, ok := rawMsg["event"]; ok {
			_ = json.Unmarshal(e, &event)
		}

		var rawData json.RawMessage
		if d, ok := rawMsg["data"]; ok {
			rawData = d
		}

		c.handleEvent(event, rawData)
	}
}

func (c *Client) handleEvent(event string, rawData json.RawMessage) {
	switch event {
	case "pusher:ping":
		_ = c.SendPusher("pusher:pong", "", "{}")

	case "pusher:pong":
		// Heartbeat ack from client

	case "pusher:subscribe":
		c.handleSubscribe(rawData)

	case "pusher:unsubscribe":
		c.handleUnsubscribe(rawData)

	default:
		// Client events: "client-*"
		if len(event) > 7 && event[:7] == "client-" {
			c.handleClientEvent(event, rawData)
		} else {
			c.SendError(fmt.Sprintf("Unknown event: %s", event), 4004)
		}
	}
}

func (c *Client) handleSubscribe(rawData json.RawMessage) {
	var payload SubscribePayload

	// Pusher clients might send data as JSON string or raw object
	var dataStr string
	if err := json.Unmarshal(rawData, &dataStr); err == nil {
		_ = json.Unmarshal([]byte(dataStr), &payload)
	} else {
		_ = json.Unmarshal(rawData, &payload)
	}

	if payload.Channel == "" {
		c.SendError("Missing channel parameter", 4001)
		return
	}

	c.hub.Subscribe(c, payload)
}

func (c *Client) handleUnsubscribe(rawData json.RawMessage) {
	var payload struct {
		Channel string `json:"channel"`
	}
	var dataStr string
	if err := json.Unmarshal(rawData, &dataStr); err == nil {
		_ = json.Unmarshal([]byte(dataStr), &payload)
	} else {
		_ = json.Unmarshal(rawData, &payload)
	}

	if payload.Channel == "" {
		return
	}

	c.hub.Unsubscribe(c, payload.Channel)
}

func (c *Client) handleClientEvent(event string, rawData json.RawMessage) {
	var channelName string
	// Client event message usually has {"channel":"...", "data":...}
	var wrapper struct {
		Channel string          `json:"channel"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(rawData, &wrapper); err == nil && wrapper.Channel != "" {
		channelName = wrapper.Channel
	}

	if channelName == "" {
		c.SendError("Client event requires channel", 4001)
		return
	}

	c.hub.HandleClientEvent(c, channelName, event, rawData)
}
