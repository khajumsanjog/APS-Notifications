package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
)

type WebhookNotifier interface {
	Notify(ctx context.Context, appID, event string, data map[string]interface{})
}

type BroadcastPayload struct {
	AppID       string          `json:"app_id"`
	ChannelName string          `json:"channel_name"`
	EventName   string          `json:"event_name"`
	Data        json.RawMessage `json:"data"`
	SocketID    string          `json:"socket_id,omitempty"`
}

type Hub struct {
	store        store.Store
	pubsub       pubsub.PubSub
	webhook      WebhookNotifier
	masterKey    []byte
	clients      map[*Client]bool
	clientsByID  map[string]*Client // key: socketID
	clientsByUser map[string]map[*Client]bool // key: appID:userID
	channels     map[string]map[*Client]bool // key: appID:channelName
	channelSubs  map[string]pubsub.Subscription // key: appID:channelName
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewHub(st store.Store, ps pubsub.PubSub, masterKey []byte, wh WebhookNotifier) *Hub {
	ctx, cancel := context.WithCancel(context.Background())
	return &Hub{
		store:         st,
		pubsub:        ps,
		webhook:       wh,
		masterKey:     masterKey,
		clients:       make(map[*Client]bool),
		clientsByID:   make(map[string]*Client),
		clientsByUser: make(map[string]map[*Client]bool),
		channels:      make(map[string]map[*Client]bool),
		channelSubs:   make(map[string]pubsub.Subscription),
		ctx:           ctx,
		cancel:        cancel,
	}
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	h.clients[client] = true
	h.clientsByID[client.socketID] = client
	h.mu.Unlock()

	// Send pusher:connection_established
	establishedData := map[string]interface{}{
		"socket_id":        client.socketID,
		"activity_timeout": 120,
	}
	_ = client.SendPusher("pusher:connection_established", "", establishedData)
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client]; !ok {
		h.mu.Unlock()
		return
	}

	delete(h.clients, client)
	delete(h.clientsByID, client.socketID)

	if client.userID != "" {
		userKey := client.appID + ":" + client.userID
		if userMap, exists := h.clientsByUser[userKey]; exists {
			delete(userMap, client)
			if len(userMap) == 0 {
				delete(h.clientsByUser, userKey)
			}
		}
	}

	// Copy subscribed channels to unsubscribe cleanly
	var subscribedChannels []string
	for ch := range client.channels {
		subscribedChannels = append(subscribedChannels, ch)
	}
	h.mu.Unlock()

	for _, ch := range subscribedChannels {
		h.Unsubscribe(client, ch)
	}
}

func (h *Hub) Subscribe(client *Client, payload SubscribePayload) {
	channelName := payload.Channel
	app, err := h.store.GetAppByID(h.ctx, client.appID)
	if err != nil {
		client.SendError("App not found", 4001)
		return
	}

	// Decrypt app secret for auth verification
	appSecretBytes, err := crypto.Decrypt(app.SecretCiphertext, h.masterKey)
	if err != nil {
		appSecretBytes = []byte(app.SecretCiphertext) // fallback
	}
	appSecret := string(appSecretBytes)

	// Auth check for private-* and presence-* channels
	isPrivate := strings.HasPrefix(channelName, "private-") || strings.HasPrefix(channelName, "private-encrypted-")
	isPresence := strings.HasPrefix(channelName, "presence-")

	var memberUserID string
	var memberUserInfo string

	if isPrivate || isPresence {
		if payload.Auth == "" {
			client.SendError("Subscription not authorized: missing auth", 4009)
			return
		}

		if !auth.VerifyChannelAuth(payload.Auth, app.AppKey, appSecret, client.socketID, channelName, payload.ChannelData) {
			client.SendError("Subscription not authorized: invalid signature", 4009)
			return
		}

		if isPresence {
			var pData struct {
				UserID   interface{}     `json:"user_id"`
				UserInfo json.RawMessage `json:"user_info"`
			}
			if err := json.Unmarshal([]byte(payload.ChannelData), &pData); err != nil {
				client.SendError("Invalid channel_data for presence channel", 4001)
				return
			}
			memberUserID = fmt.Sprintf("%v", pData.UserID)
			memberUserInfo = string(pData.UserInfo)
			client.userID = memberUserID

			h.mu.Lock()
			userKey := client.appID + ":" + memberUserID
			if _, ok := h.clientsByUser[userKey]; !ok {
				h.clientsByUser[userKey] = make(map[*Client]bool)
			}
			h.clientsByUser[userKey][client] = true
			h.mu.Unlock()
		}
	}

	channelKey := client.appID + ":" + channelName

	h.mu.Lock()
	client.channels[channelName] = true
	isFirstLocalSub := false
	if _, ok := h.channels[channelKey]; !ok {
		h.channels[channelKey] = make(map[*Client]bool)
		isFirstLocalSub = true
	}
	h.channels[channelKey][client] = true
	h.mu.Unlock()

	// If first local subscriber, subscribe to pubsub broker for cross-cluster events
	if isFirstLocalSub {
		h.ensurePubSubSubscription(client.appID, channelName)
	}

	// Presence channel setup
	if isPresence {
		_ = h.pubsub.AddPresenceMember(h.ctx, client.appID, channelName, client.socketID, memberUserID, memberUserInfo)

		// Get all current members
		members, _ := h.pubsub.GetPresenceMembers(h.ctx, client.appID, channelName)

		ids := make([]string, 0, len(members))
		hash := make(map[string]interface{})
		for uid, infoStr := range members {
			ids = append(ids, uid)
			var infoObj interface{}
			if err := json.Unmarshal([]byte(infoStr), &infoObj); err == nil {
				hash[uid] = infoObj
			} else {
				hash[uid] = infoStr
			}
		}

		// Send subscription_succeeded to this client
		succPayload := map[string]interface{}{
			"presence": map[string]interface{}{
				"ids":   ids,
				"hash":  hash,
				"count": len(ids),
			},
		}
		_ = client.SendPusher("pusher_internal:subscription_succeeded", channelName, succPayload)

		// Broadcast member_added to all other members
		var userObj interface{}
		_ = json.Unmarshal([]byte(memberUserInfo), &userObj)
		memberAddedPayload := map[string]interface{}{
			"user_id":   memberUserID,
			"user_info": userObj,
		}
		h.BroadcastLocal(client.appID, channelName, "pusher_internal:member_added", memberAddedPayload, client.socketID)

		// Publish to cluster as well
		clusterPayload, _ := json.Marshal(BroadcastPayload{
			AppID:       client.appID,
			ChannelName: channelName,
			EventName:   "pusher_internal:member_added",
			Data:        json.RawMessage(mustJSON(memberAddedPayload)),
			SocketID:    client.socketID,
		})
		_ = h.pubsub.Publish(h.ctx, "aps:events:"+channelKey, clusterPayload)

		// Webhook: member_added
		if h.webhook != nil {
			h.webhook.Notify(h.ctx, client.appID, "member_added", map[string]interface{}{
				"channel":   channelName,
				"user_id":   memberUserID,
				"socket_id": client.socketID,
			})
		}
	} else {
		// Acknowledge public/private subscription
		_ = client.SendPusher("pusher_internal:subscription_succeeded", channelName, "{}")
	}

	// Webhook: channel_occupied if 1st member
	occupancy, _ := h.pubsub.GetChannelOccupancy(h.ctx, client.appID, channelName)
	if occupancy == 1 && h.webhook != nil {
		h.webhook.Notify(h.ctx, client.appID, "channel_occupied", map[string]interface{}{
			"channel": channelName,
		})
	}
}

func (h *Hub) Unsubscribe(client *Client, channelName string) {
	channelKey := client.appID + ":" + channelName

	h.mu.Lock()
	delete(client.channels, channelName)
	if subs, ok := h.channels[channelKey]; ok {
		delete(subs, client)
		if len(subs) == 0 {
			delete(h.channels, channelKey)
			if psSub, exists := h.channelSubs[channelKey]; exists {
				_ = psSub.Close()
				delete(h.channelSubs, channelKey)
			}
		}
	}
	h.mu.Unlock()

	isPresence := strings.HasPrefix(channelName, "presence-")
	if isPresence {
		removedUserID, _ := h.pubsub.RemovePresenceMember(h.ctx, client.appID, channelName, client.socketID)
		if removedUserID != "" {
			memberRemovedPayload := map[string]interface{}{
				"user_id": removedUserID,
			}
			h.BroadcastLocal(client.appID, channelName, "pusher_internal:member_removed", memberRemovedPayload, client.socketID)

			clusterPayload, _ := json.Marshal(BroadcastPayload{
				AppID:       client.appID,
				ChannelName: channelName,
				EventName:   "pusher_internal:member_removed",
				Data:        json.RawMessage(mustJSON(memberRemovedPayload)),
				SocketID:    client.socketID,
			})
			_ = h.pubsub.Publish(h.ctx, "aps:events:"+channelKey, clusterPayload)

			// Webhook: member_removed
			if h.webhook != nil {
				h.webhook.Notify(h.ctx, client.appID, "member_removed", map[string]interface{}{
					"channel":   channelName,
					"user_id":   removedUserID,
					"socket_id": client.socketID,
				})
			}
		}
	}

	// Check if channel is now vacant
	occupancy, _ := h.pubsub.GetChannelOccupancy(h.ctx, client.appID, channelName)
	if occupancy == 0 && h.webhook != nil {
		h.webhook.Notify(h.ctx, client.appID, "channel_vacated", map[string]interface{}{
			"channel": channelName,
		})
	}
}

func (h *Hub) HandleClientEvent(client *Client, channelName, event string, rawData json.RawMessage) {
	// Client events only allowed on private-* or presence-*
	if !strings.HasPrefix(channelName, "private-") && !strings.HasPrefix(channelName, "presence-") {
		client.SendError("Client events only allowed on private/presence channels", 4009)
		return
	}

	h.mu.RLock()
	isSubscribed := client.channels[channelName]
	h.mu.RUnlock()

	if !isSubscribed {
		client.SendError(fmt.Sprintf("Not subscribed to %s", channelName), 4009)
		return
	}

	// Forward to local subscribers (excluding sender)
	h.BroadcastLocal(client.appID, channelName, event, rawData, client.socketID)

	// Publish to Redis/cluster for other nodes
	channelKey := client.appID + ":" + channelName
	clusterPayload, _ := json.Marshal(BroadcastPayload{
		AppID:       client.appID,
		ChannelName: channelName,
		EventName:   event,
		Data:        rawData,
		SocketID:    client.socketID,
	})
	_ = h.pubsub.Publish(h.ctx, "aps:events:"+channelKey, clusterPayload)

	// Webhook: client_event
	if h.webhook != nil {
		h.webhook.Notify(h.ctx, client.appID, "client_event", map[string]interface{}{
			"channel":   channelName,
			"event":     event,
			"data":      string(rawData),
			"socket_id": client.socketID,
			"user_id":   client.userID,
		})
	}
}

// BroadcastLocal sends an event to all local subscribers of a channel (optionally excluding socketID)
func (h *Hub) BroadcastLocal(appID, channelName, event string, data interface{}, excludeSocketID string) {
	channelKey := appID + ":" + channelName

	h.mu.RLock()
	subs, ok := h.channels[channelKey]
	if !ok {
		h.mu.RUnlock()
		return
	}

	clients := make([]*Client, 0, len(subs))
	for c := range subs {
		if excludeSocketID != "" && c.socketID == excludeSocketID {
			continue
		}
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		_ = c.SendPusher(event, channelName, data)
	}
}

// BroadcastCluster initiates a broadcast to local clients and publishes to the cluster
func (h *Hub) BroadcastCluster(appID, channelName, event string, data json.RawMessage, excludeSocketID string) error {
	// Save to channel history if enabled
	_ = h.store.SaveChannelMessage(h.ctx, &models.ChannelMessage{
		AppID:       appID,
		ChannelName: channelName,
		EventName:   event,
		Payload:     string(data),
		SocketID:    excludeSocketID,
	})

	// 1. Send to local clients
	h.BroadcastLocal(appID, channelName, event, data, excludeSocketID)

	// 2. Publish to cluster topic
	channelKey := appID + ":" + channelName
	clusterPayload, err := json.Marshal(BroadcastPayload{
		AppID:       appID,
		ChannelName: channelName,
		EventName:   event,
		Data:        data,
		SocketID:    excludeSocketID,
	})
	if err != nil {
		return err
	}

	return h.pubsub.Publish(h.ctx, "aps:events:"+channelKey, clusterPayload)
}

func (h *Hub) ensurePubSubSubscription(appID, channelName string) {
	channelKey := appID + ":" + channelName
	topic := "aps:events:" + channelKey

	sub, err := h.pubsub.Subscribe(h.ctx, topic)
	if err != nil {
		return
	}

	h.mu.Lock()
	h.channelSubs[channelKey] = sub
	h.mu.Unlock()

	go func() {
		ch := sub.Channel()
		for msg := range ch {
			var bp BroadcastPayload
			if err := json.Unmarshal(msg.Payload, &bp); err != nil {
				continue
			}
			h.BroadcastLocal(bp.AppID, bp.ChannelName, bp.EventName, bp.Data, bp.SocketID)
		}
	}()
}

// TerminateSocket kicks a specific socket ID
func (h *Hub) TerminateSocket(socketID string) bool {
	h.mu.RLock()
	client, ok := h.clientsByID[socketID]
	h.mu.RUnlock()

	if !ok {
		return false
	}

	client.SendError("Connection terminated by server administrator", 4004)
	client.Close()
	return true
}

// TerminateUser kicks all sockets associated with a user ID in an app
func (h *Hub) TerminateUser(appID, userID string) int {
	userKey := appID + ":" + userID
	h.mu.RLock()
	userMap, ok := h.clientsByUser[userKey]
	if !ok {
		h.mu.RUnlock()
		return 0
	}

	clients := make([]*Client, 0, len(userMap))
	for c := range userMap {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		c.SendError("User session terminated", 4004)
		c.Close()
	}
	return len(clients)
}

func (h *Hub) GetActiveConnectionCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
