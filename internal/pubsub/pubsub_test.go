package pubsub

import (
	"context"
	"testing"
	"time"
)

func TestMemoryPubSub(t *testing.T) {
	ctx := context.Background()
	ps := NewMemoryPubSub()
	defer ps.Close()

	topic := "apps:100:my-channel"
	sub, err := ps.Subscribe(ctx, topic)
	if err != nil {
		t.Fatalf("Subscribe failed: %v", err)
	}
	defer sub.Close()

	expectedPayload := []byte(`{"event":"test","data":"sample"}`)
	if err := ps.Publish(ctx, topic, expectedPayload); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	select {
	case msg := <-sub.Channel():
		if msg.Topic != topic {
			t.Fatalf("Expected topic %s, got %s", topic, msg.Topic)
		}
		if string(msg.Payload) != string(expectedPayload) {
			t.Fatalf("Payload mismatch")
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("Timed out waiting for message")
	}

	// Presence
	appID := "100"
	channel := "presence-lobby"
	socketID := "sock-1"
	userID := "user-alice"
	userInfo := `{"name":"Alice"}`

	if err := ps.AddPresenceMember(ctx, appID, channel, socketID, userID, userInfo); err != nil {
		t.Fatalf("AddPresenceMember failed: %v", err)
	}

	occupancy, err := ps.GetChannelOccupancy(ctx, appID, channel)
	if err != nil || occupancy != 1 {
		t.Fatalf("Expected occupancy 1, got %d", occupancy)
	}

	members, err := ps.GetPresenceMembers(ctx, appID, channel)
	if err != nil || members[userID] != userInfo {
		t.Fatalf("Presence members mismatch: %+v", members)
	}

	removedUser, err := ps.RemovePresenceMember(ctx, appID, channel, socketID)
	if err != nil || removedUser != userID {
		t.Fatalf("Expected removed user %s, got %s", userID, removedUser)
	}

	occupancy, _ = ps.GetChannelOccupancy(ctx, appID, channel)
	if occupancy != 0 {
		t.Fatalf("Expected occupancy 0 after remove, got %d", occupancy)
	}
}
