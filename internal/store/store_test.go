package store

import (
	"context"
	"testing"

	"github.com/khajumsanjog/aps/internal/models"
)

func TestMemoryStore(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()

	// 1. User
	user := &models.User{
		ID:           "u1",
		Email:        "admin@khajumsanjog.com",
		PasswordHash: "hash123",
		Role:         "admin",
	}
	if err := s.CreateUser(ctx, user); err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	fetchedUser, err := s.GetUserByEmail(ctx, "admin@khajumsanjog.com")
	if err != nil || fetchedUser.ID != "u1" {
		t.Fatalf("GetUserByEmail failed: %v", err)
	}

	// 2. App
	app := &models.App{
		ID:                    "app-1",
		Name:                  "Test App",
		AppKey:                "key-123",
		SecretCiphertext:      "enc-secret",
		OwnerID:               "u1",
		Cluster:               "mt1",
		RateLimitRPS:          1000,
		MaxConnections:        5000,
		MessageHistoryEnabled: true,
	}
	if err := s.CreateApp(ctx, app); err != nil {
		t.Fatalf("CreateApp failed: %v", err)
	}

	fetchedApp, err := s.GetAppByKey(ctx, "key-123")
	if err != nil || fetchedApp.ID != "app-1" {
		t.Fatalf("GetAppByKey failed: %v", err)
	}

	// 3. Beams Instance & Device
	instance := &models.BeamsInstance{
		InstanceID: "inst-1",
		AppID:      "app-1",
	}
	if err := s.CreateBeamsInstance(ctx, instance); err != nil {
		t.Fatalf("CreateBeamsInstance failed: %v", err)
	}

	uid := "user_42"
	device := &models.Device{
		DeviceID:   "dev-1",
		InstanceID: "inst-1",
		Platform:   "fcm",
		Token:      "fcm-token-abc",
		UserID:     &uid,
		Interests:  []string{"news", "sports"},
	}
	if err := s.UpsertDevice(ctx, device); err != nil {
		t.Fatalf("UpsertDevice failed: %v", err)
	}

	devices, err := s.ListDevicesByInterests(ctx, "inst-1", []string{"sports"})
	if err != nil || len(devices) != 1 {
		t.Fatalf("ListDevicesByInterests failed: len=%d, err=%v", len(devices), err)
	}

	// 4. Channel history
	msg := &models.ChannelMessage{
		AppID:       "app-1",
		ChannelName: "my-channel",
		EventName:   "greeting",
		Payload:     `{"text":"hello"}`,
	}
	if err := s.SaveChannelMessage(ctx, msg); err != nil {
		t.Fatalf("SaveChannelMessage failed: %v", err)
	}

	history, err := s.GetChannelHistory(ctx, "app-1", "my-channel", 10)
	if err != nil || len(history) != 1 {
		t.Fatalf("GetChannelHistory failed: len=%d, err=%v", len(history), err)
	}
}
