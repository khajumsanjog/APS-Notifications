package ws

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
	"nhooyr.io/websocket"
)

func TestWebSocketPusherProtocol(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()
	ps := pubsub.NewMemoryPubSub()
	masterKey := crypto.DeriveKey("test-master-key")

	appKey := "app-key-test"
	appSecret := "app-secret-test"
	encSecret, _ := crypto.Encrypt([]byte(appSecret), masterKey)

	app := &models.App{
		ID:               "app-100",
		Name:             "Test WS App",
		AppKey:           appKey,
		SecretCiphertext: encSecret,
		OwnerID:          "usr-1",
	}
	_ = st.CreateApp(ctx, app)

	hub := NewHub(st, ps, masterKey, nil)
	server := NewServer(hub, st, 30*time.Second)

	ts := httptest.NewServer(server.Routes())
	defer ts.Close()

	wsURL := strings.Replace(ts.URL, "http://", "ws://", 1) + "/app/" + appKey

	// Connect client 1
	conn1, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect client 1: %v", err)
	}
	defer conn1.Close(websocket.StatusNormalClosure, "")

	// 1. Read connection_established
	_, msgBytes, err := conn1.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read established message: %v", err)
	}

	var estMsg map[string]interface{}
	_ = json.Unmarshal(msgBytes, &estMsg)
	if estMsg["event"] != "pusher:connection_established" {
		t.Fatalf("Expected pusher:connection_established, got %v", estMsg["event"])
	}

	var estData struct {
		SocketID string `json:"socket_id"`
	}
	switch v := estMsg["data"].(type) {
	case string:
		_ = json.Unmarshal([]byte(v), &estData)
	case map[string]interface{}:
		estData.SocketID, _ = v["socket_id"].(string)
	}

	if estData.SocketID == "" {
		t.Fatalf("Expected non-empty socket_id")
	}

	// 2. Test Ping/Pong
	pingMsg := map[string]interface{}{
		"event": "pusher:ping",
		"data":  "{}",
	}
	pingBytes, _ := json.Marshal(pingMsg)
	if err := conn1.Write(ctx, websocket.MessageText, pingBytes); err != nil {
		t.Fatalf("Failed to write ping: %v", err)
	}

	_, pongBytes, err := conn1.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read pong: %v", err)
	}

	var pongMsg map[string]interface{}
	_ = json.Unmarshal(pongBytes, &pongMsg)
	if pongMsg["event"] != "pusher:pong" {
		t.Fatalf("Expected pusher:pong, got %v", pongMsg["event"])
	}

	// 3. Test Subscribe to Public Channel
	subMsg := map[string]interface{}{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"channel": "public-news",
		},
	}
	subBytes, _ := json.Marshal(subMsg)
	if err := conn1.Write(ctx, websocket.MessageText, subBytes); err != nil {
		t.Fatalf("Failed to write subscribe: %v", err)
	}

	_, succBytes, err := conn1.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read subscription succeeded: %v", err)
	}
	var succMsg map[string]interface{}
	_ = json.Unmarshal(succBytes, &succMsg)
	if succMsg["event"] != "pusher_internal:subscription_succeeded" {
		t.Fatalf("Expected subscription_succeeded, got %v", succMsg["event"])
	}

	// 4. Test Private Channel with HMAC Auth
	privateChannel := "private-orders"
	authSig := auth.GenerateChannelAuth(appKey, appSecret, estData.SocketID, privateChannel, "")

	privSubMsg := map[string]interface{}{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"channel": privateChannel,
			"auth":    authSig,
		},
	}
	privBytes, _ := json.Marshal(privSubMsg)
	if err := conn1.Write(ctx, websocket.MessageText, privBytes); err != nil {
		t.Fatalf("Failed to write private subscribe: %v", err)
	}

	_, privSuccBytes, err := conn1.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read private succ: %v", err)
	}
	var privSuccMsg map[string]interface{}
	_ = json.Unmarshal(privSuccBytes, &privSuccMsg)
	if privSuccMsg["event"] != "pusher_internal:subscription_succeeded" {
		t.Fatalf("Expected private subscription_succeeded, got %v", privSuccMsg["event"])
	}

	// 5. Test Broadcast from Hub to Connected Client
	testEventData := `{"text":"breaking news"}`
	err = hub.BroadcastCluster("app-100", "public-news", "news_event", json.RawMessage(testEventData), "")
	if err != nil {
		t.Fatalf("BroadcastCluster failed: %v", err)
	}

	_, bcBytes, err := conn1.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read broadcast: %v", err)
	}
	var bcMsg map[string]interface{}
	_ = json.Unmarshal(bcBytes, &bcMsg)
	if bcMsg["event"] != "news_event" || bcMsg["channel"] != "public-news" {
		t.Fatalf("Unexpected broadcast message: %+v", bcMsg)
	}
}
