package beams

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/store"
)

func TestBeamsDeviceAndPublish(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()
	masterKey := crypto.DeriveKey("test-master-key")

	inst := &models.BeamsInstance{
		InstanceID: "inst_beams_1",
		AppID:      "app_1",
	}
	_ = st.CreateBeamsInstance(ctx, inst)

	svc := NewService(st, masterKey)
	router := svc.Routes()

	// 1. Register FCM device
	fcmRegBody := []byte(`{
		"token": "fcm_token_xyz_123",
		"interests": ["announcements", "chat-room-1"]
	}`)
	req := httptest.NewRequest("POST", "/beams/inst_beams_1/devices/fcm/register", bytes.NewBuffer(fcmRegBody))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("FCM register failed: %d, %s", w.Code, w.Body.String())
	}

	var devResp models.Device
	_ = json.Unmarshal(w.Body.Bytes(), &devResp)
	if devResp.DeviceID == "" || devResp.Platform != "fcm" {
		t.Fatalf("Unexpected device response: %+v", devResp)
	}

	// 2. Publish to interest
	pubBody := []byte(`{
		"interests": ["announcements"],
		"fcm": {
			"notification": {
				"title": "Welcome",
				"body": "Welcome to APS Beams"
			}
		}
	}`)
	pubReq := httptest.NewRequest("POST", "/beams/inst_beams_1/publishes/interests", bytes.NewBuffer(pubBody))
	pubW := httptest.NewRecorder()
	router.ServeHTTP(pubW, pubReq)

	if pubW.Code != http.StatusOK {
		t.Fatalf("Publish interests failed: %d, %s", pubW.Code, pubW.Body.String())
	}

	var pubResp struct {
		PublishID string `json:"publish_id"`
		SentCount int    `json:"sent_count"`
	}
	_ = json.Unmarshal(pubW.Body.Bytes(), &pubResp)
	if pubResp.PublishID == "" || pubResp.SentCount != 1 {
		t.Fatalf("Unexpected publish response: %+v", pubResp)
	}

	// 3. Verify delivery receipt was recorded
	deliveries, err := st.ListPushDeliveries(ctx, "inst_beams_1", 10)
	if err != nil || len(deliveries) != 1 {
		t.Fatalf("Expected 1 delivery receipt, got %d, err: %v", len(deliveries), err)
	}
}
