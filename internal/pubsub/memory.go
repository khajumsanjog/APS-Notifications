package pubsub

import (
	"context"
	"strings"
	"sync"
)

type MemorySubscription struct {
	broker *MemoryPubSub
	ch     chan *Message
	topics map[string]struct{}
	closed bool
	mu     sync.Mutex
}

func (s *MemorySubscription) Channel() <-chan *Message {
	return s.ch
}

func (s *MemorySubscription) Unsubscribe(topics ...string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, t := range topics {
		delete(s.topics, t)
	}
	return nil
}

func (s *MemorySubscription) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.closed {
		s.closed = true
		close(s.ch)
		s.broker.removeSub(s)
	}
	return nil
}

type MemoryPubSub struct {
	mu          sync.RWMutex
	subs        []*MemorySubscription
	presence    map[string]map[string]PresenceMember // key: appID:channelName -> socketID -> member
	occupancies map[string]int                       // key: appID:channelName -> count
}

func NewMemoryPubSub() *MemoryPubSub {
	return &MemoryPubSub{
		subs:        make([]*MemorySubscription, 0),
		presence:    make(map[string]map[string]PresenceMember),
		occupancies: make(map[string]int),
	}
}

func (m *MemoryPubSub) removeSub(target *MemorySubscription) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, sub := range m.subs {
		if sub == target {
			m.subs = append(m.subs[:i], m.subs[i+1:]...)
			break
		}
	}
}

func (m *MemoryPubSub) Publish(ctx context.Context, topic string, payload []byte) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	msg := &Message{Topic: topic, Payload: payload}
	for _, sub := range m.subs {
		sub.mu.Lock()
		if !sub.closed {
			if _, ok := sub.topics[topic]; ok {
				select {
				case sub.ch <- msg:
				default:
					// dropped if receiver is slow/full
				}
			}
		}
		sub.mu.Unlock()
	}
	return nil
}

func (m *MemoryPubSub) Subscribe(ctx context.Context, topics ...string) (Subscription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	topicMap := make(map[string]struct{})
	for _, t := range topics {
		topicMap[t] = struct{}{}
	}

	sub := &MemorySubscription{
		broker: m,
		ch:     make(chan *Message, 256),
		topics: topicMap,
	}
	m.subs = append(m.subs, sub)
	return sub, nil
}

func (m *MemoryPubSub) AddPresenceMember(ctx context.Context, appID, channelName, socketID, userID, userInfo string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := appID + ":" + channelName
	if _, ok := m.presence[key]; !ok {
		m.presence[key] = make(map[string]PresenceMember)
	}
	m.presence[key][socketID] = PresenceMember{
		UserID:   userID,
		UserInfo: userInfo,
		SocketID: socketID,
	}
	m.occupancies[key] = len(m.presence[key])
	return nil
}

func (m *MemoryPubSub) RemovePresenceMember(ctx context.Context, appID, channelName, socketID string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := appID + ":" + channelName
	members, ok := m.presence[key]
	if !ok {
		return "", nil
	}

	member, exists := members[socketID]
	if !exists {
		return "", nil
	}

	delete(members, socketID)
	m.occupancies[key] = len(members)
	if len(members) == 0 {
		delete(m.presence, key)
		delete(m.occupancies, key)
	}

	return member.UserID, nil
}

func (m *MemoryPubSub) GetPresenceMembers(ctx context.Context, appID, channelName string) (map[string]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := appID + ":" + channelName
	res := make(map[string]string)
	members, ok := m.presence[key]
	if !ok {
		return res, nil
	}

	for _, mem := range members {
		res[mem.UserID] = mem.UserInfo
	}
	return res, nil
}

func (m *MemoryPubSub) GetChannelOccupancy(ctx context.Context, appID, channelName string) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := appID + ":" + channelName
	return m.occupancies[key], nil
}

func (m *MemoryPubSub) ListOccupiedChannels(ctx context.Context, appID, prefix string) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	appPrefix := appID + ":"
	var result []string
	for k, count := range m.occupancies {
		if count > 0 && strings.HasPrefix(k, appPrefix) {
			channelName := strings.TrimPrefix(k, appPrefix)
			if prefix == "" || strings.HasPrefix(channelName, prefix) {
				result = append(result, channelName)
			}
		}
	}
	return result, nil
}

func (m *MemoryPubSub) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, sub := range m.subs {
		sub.mu.Lock()
		if !sub.closed {
			sub.closed = true
			close(sub.ch)
		}
		sub.mu.Unlock()
	}
	m.subs = nil
	return nil
}
