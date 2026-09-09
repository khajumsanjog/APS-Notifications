package pubsub

import (
	"context"
)

type Message struct {
	Topic   string `json:"topic"`
	Payload []byte `json:"payload"`
}

type Subscription interface {
	Channel() <-chan *Message
	Unsubscribe(topics ...string) error
	Close() error
}

type PresenceMember struct {
	UserID   string `json:"user_id"`
	UserInfo string `json:"user_info"` // JSON string
	SocketID string `json:"socket_id"`
}

type PubSub interface {
	Publish(ctx context.Context, topic string, payload []byte) error
	Subscribe(ctx context.Context, topics ...string) (Subscription, error)

	// Presence tracking across cluster
	AddPresenceMember(ctx context.Context, appID, channelName, socketID, userID, userInfo string) error
	RemovePresenceMember(ctx context.Context, appID, channelName, socketID string) (string, error) // returns removed userID
	GetPresenceMembers(ctx context.Context, appID, channelName string) (map[string]string, error)  // userID -> userInfo JSON
	GetChannelOccupancy(ctx context.Context, appID, channelName string) (int, error)
	ListOccupiedChannels(ctx context.Context, appID, prefix string) ([]string, error)

	Close() error
}
