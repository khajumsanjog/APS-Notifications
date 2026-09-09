package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
	"github.com/khajumsanjog/aps/internal/ws"
)

func TestAPIPusherTriggerAndAuth(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()
	ps := pubsub.NewMemoryPubSub()
	masterKey := crypto.DeriveKey("test-master-key")
	jwtSecret := "test-jwt-secret-key-32b-long"

	appID := "1001"
	appKey := "app_key_1001"
	appSecret := "app_secret_1001"
	encSecret, _ := crypto.Encrypt([]byte(appSecret), masterKey)

	app := &models.App{
		ID:               appID,
		Name:             "API Test App",
		AppKey:           appKey,
		SecretCiphertext: encSecret,
		OwnerID:          "usr-test",
		Cluster:          "mt1",
	}
	_ = st.CreateApp(ctx, app)

	hub := ws.NewHub(st, ps, masterKey, nil)
	api := NewAPI(st, hub, ps, nil, masterKey, jwtSecret)

	router := api.Routes()

	// 1. Test Pusher Event Trigger
	body := []byte(`{"name":"order_created","channels":["orders"],"data":"{\"order_id\":42}"}`)
	reqPath := "/apps/" + appID + "/events"

	_, signedParams := auth.SignRESTRequest("POST", reqPath, appKey, appSecret, make(url.Values), body, time.Now())

	req := httptest.NewRequest("POST", reqPath+"?"+signedParams.Encode(), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 2. Test Channel History
	history, err := st.GetChannelHistory(ctx, appID, "orders", 10)
	if err != nil || len(history) != 1 {
		t.Fatalf("Expected 1 history item, got %d, err: %v", len(history), err)
	}

	// 3. Test Dashboard User Registration & Login
	regBody := []byte(`{"email":"dev@khajumsanjog.com","password":"secretpassword"}`)
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	router.ServeHTTP(regW, regReq)

	if regW.Code != http.StatusOK {
		t.Fatalf("Register failed: %d, body: %s", regW.Code, regW.Body.String())
	}

	var regResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(regW.Body.Bytes(), &regResp)
	if regResp.Token == "" {
		t.Fatalf("Expected auth token in register response")
	}

	// 4. Test Create App via Dashboard API
	createAppBody := []byte(`{"name":"Production App","cluster":"ap1"}`)
	createAppReq := httptest.NewRequest("POST", "/api/apps", bytes.NewBuffer(createAppBody))
	createAppReq.Header.Set("Content-Type", "application/json")
	createAppReq.Header.Set("Authorization", "Bearer "+regResp.Token)
	createAppW := httptest.NewRecorder()
	router.ServeHTTP(createAppW, createAppReq)

	if createAppW.Code != http.StatusCreated {
		t.Fatalf("Create App failed: %d, body: %s", createAppW.Code, createAppW.Body.String())
	}
}
