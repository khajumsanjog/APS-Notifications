package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/khajumsanjog/aps/internal/api"
	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/beams"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
	"github.com/khajumsanjog/aps/internal/webhook"
	"github.com/khajumsanjog/aps/internal/ws"
	"nhooyr.io/websocket"
)

func TestPusherAndBeamsEndToEnd(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()
	ps := pubsub.NewMemoryPubSub()
	masterKey := crypto.DeriveKey("master-key-integration-test-32b")
	jwtSecret := "jwt-secret-integration-test-32b"

	appID := "app_integration_1"
	appKey := "key_test_12345"
	appSecret := "secret_test_67890"
	encSecret, _ := crypto.Encrypt([]byte(appSecret), masterKey)

	app := &models.App{
		ID:                    appID,
		Name:                  "E2E Test App",
		AppKey:                appKey,
		SecretCiphertext:      encSecret,
		OwnerID:               "usr-owner",
		Cluster:               "mt1",
		MessageHistoryEnabled: true,
	}
	_ = st.CreateApp(ctx, app)

	beamsInst := &models.BeamsInstance{
		InstanceID: "beams_inst_1",
		AppID:      appID,
	}
	_ = st.CreateBeamsInstance(ctx, beamsInst)

	wh := webhook.NewDispatcher(st, masterKey)
	hub := ws.NewHub(st, ps, masterKey, wh)
	beamsSvc := beams.NewService(st, masterKey)
	apiSvc := api.NewAPI(st, hub, ps, beamsSvc, masterKey, jwtSecret)
	wsServer := ws.NewServer(hub, st, 60*time.Second)

	// Multiplex routes like APS all-in-one
	mux := chi.NewRouter()
	mux.Mount("/app", wsServer.Routes())
	mux.Mount("/beams", beamsSvc.Routes())
	mux.Mount("/", apiSvc.Routes())

	ts := httptest.NewServer(mux)
	defer ts.Close()

	// -------------------------------------------------------------
	// 1. Test WebSocket Pusher Handshake
	// -------------------------------------------------------------
	wsURL := strings.Replace(ts.URL, "http://", "ws://", 1) + "/app/" + appKey + "?protocol=7&client=js&version=8.4.0"
	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Read connection_established
	_, msgBytes, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read connection_established: %v", err)
	}

	var estMsg struct {
		Event string `json:"event"`
		Data  string `json:"data"`
	}
	if err := json.Unmarshal(msgBytes, &estMsg); err != nil || estMsg.Event != "pusher:connection_established" {
		t.Fatalf("Expected pusher:connection_established, got: %s", string(msgBytes))
	}

	var estData struct {
		SocketID string `json:"socket_id"`
	}
	_ = json.Unmarshal([]byte(estMsg.Data), &estData)
	if estData.SocketID == "" {
		t.Fatalf("Expected non-empty socket_id")
	}

	// -------------------------------------------------------------
	// 2. Ping / Pong
	// -------------------------------------------------------------
	pingJSON, _ := json.Marshal(map[string]string{"event": "pusher:ping", "data": "{}"})
	_ = conn.Write(ctx, websocket.MessageText, pingJSON)

	_, pongBytes, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read pong: %v", err)
	}
	if !strings.Contains(string(pongBytes), "pusher:pong") {
		t.Fatalf("Expected pusher:pong, got: %s", string(pongBytes))
	}

	// -------------------------------------------------------------
	// 3. Subscribe to Public & Private Channel
	// -------------------------------------------------------------
	// Public channel
	subPublic, _ := json.Marshal(map[string]interface{}{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"channel": "notifications",
		},
	})
	_ = conn.Write(ctx, websocket.MessageText, subPublic)

	_, pubSucc, _ := conn.Read(ctx)
	if !strings.Contains(string(pubSucc), "subscription_succeeded") {
		t.Fatalf("Expected subscription_succeeded, got: %s", string(pubSucc))
	}

	// Private channel with HMAC
	privateChannel := "private-alerts"
	privateAuth := auth.GenerateChannelAuth(appKey, appSecret, estData.SocketID, privateChannel, "")
	subPrivate, _ := json.Marshal(map[string]interface{}{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"channel": privateChannel,
			"auth":    privateAuth,
		},
	})
	_ = conn.Write(ctx, websocket.MessageText, subPrivate)

	_, privSucc, _ := conn.Read(ctx)
	if !strings.Contains(string(privSucc), "subscription_succeeded") {
		t.Fatalf("Expected private subscription_succeeded, got: %s", string(privSucc))
	}

	// -------------------------------------------------------------
	// 4. REST Trigger -> Received via WebSocket
	// -------------------------------------------------------------
	eventPayload := []byte(`{"name":"alert_broadcast","channels":["private-alerts"],"data":{"severity":"high","msg":"system alert"}}`)
	reqPath := fmt.Sprintf("/apps/%s/events", appID)

	_, signedParams := auth.SignRESTRequest("POST", reqPath, appKey, appSecret, make(url.Values), eventPayload, time.Now())
	triggerURL := fmt.Sprintf("%s%s?%s", ts.URL, reqPath, signedParams.Encode())

	req, _ := http.NewRequest("POST", triggerURL, bytes.NewReader(eventPayload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("REST trigger failed, err=%v, code=%v", err, resp.StatusCode)
	}

	// Read event delivered via WebSocket
	_, eventBytes, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("Failed to read triggered event from WebSocket: %v", err)
	}

	var deliveredMsg struct {
		Event   string          `json:"event"`
		Channel string          `json:"channel"`
		Data    json.RawMessage `json:"data"`
	}
	_ = json.Unmarshal(eventBytes, &deliveredMsg)
	if deliveredMsg.Event != "alert_broadcast" || deliveredMsg.Channel != "private-alerts" {
		t.Fatalf("Unexpected delivered message: %s", string(eventBytes))
	}

	// -------------------------------------------------------------
	// 5. Message History Retrieval
	// -------------------------------------------------------------
	histURL := fmt.Sprintf("%s/apps/%s/channels/private-alerts/history", ts.URL, appID)
	_, histParams := auth.SignRESTRequest("GET", fmt.Sprintf("/apps/%s/channels/private-alerts/history", appID), appKey, appSecret, make(url.Values), nil, time.Now())
	histReq, _ := http.NewRequest("GET", histURL+"?"+histParams.Encode(), nil)
	histResp, err := http.DefaultClient.Do(histReq)
	if err != nil || histResp.StatusCode != http.StatusOK {
		t.Fatalf("History retrieval failed, code=%d", histResp.StatusCode)
	}

	var histData struct {
		Messages []models.ChannelMessage `json:"messages"`
	}
	_ = json.NewDecoder(histResp.Body).Decode(&histData)
	if len(histData.Messages) == 0 {
		t.Fatalf("Expected at least 1 message in channel history")
	}

	// -------------------------------------------------------------
	// 6. APS Beams Push Engine Test
	// -------------------------------------------------------------
	// Register device
	fcmRegPayload := []byte(`{"token":"fcm_token_e2e_test","interests":["breaking-news"]}`)
	regURL := fmt.Sprintf("%s/beams/beams_inst_1/devices/fcm/register", ts.URL)
	fcmReq, _ := http.NewRequest("POST", regURL, bytes.NewReader(fcmRegPayload))
	fcmReq.Header.Set("Content-Type", "application/json")
	fcmResp, err := http.DefaultClient.Do(fcmReq)
	if err != nil || fcmResp.StatusCode != http.StatusCreated {
		t.Fatalf("Beams device registration failed: %v", err)
	}

	// Publish to interest
	pubPayload := []byte(`{"interests":["breaking-news"],"fcm":{"notification":{"title":"Breaking News","body":"Test Body"}}}`)
	pubURL := fmt.Sprintf("%s/beams/beams_inst_1/publishes/interests", ts.URL)
	pubReq, _ := http.NewRequest("POST", pubURL, bytes.NewReader(pubPayload))
	pubReq.Header.Set("Content-Type", "application/json")
	pubResp, err := http.DefaultClient.Do(pubReq)
	if err != nil || pubResp.StatusCode != http.StatusOK {
		t.Fatalf("Beams publish failed: %v", err)
	}

	var pubData struct {
		PublishID string `json:"publish_id"`
		SentCount int    `json:"sent_count"`
	}
	_ = json.NewDecoder(pubResp.Body).Decode(&pubData)
	if pubData.PublishID == "" || pubData.SentCount != 1 {
		t.Fatalf("Unexpected Beams publish result: %+v", pubData)
	}
}
