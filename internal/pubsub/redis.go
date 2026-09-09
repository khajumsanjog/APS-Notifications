package pubsub

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
)

type RedisSubscription struct {
	pubsub *redis.PubSub
	ch     chan *Message
	ctx    context.Context
	cancel context.CancelFunc
	once   sync.Once
}

func (s *RedisSubscription) Channel() <-chan *Message {
	return s.ch
}

func (s *RedisSubscription) Unsubscribe(topics ...string) error {
	return s.pubsub.Unsubscribe(s.ctx, topics...)
}

func (s *RedisSubscription) Close() error {
	s.once.Do(func() {
		s.cancel()
		_ = s.pubsub.Close()
	})
	return nil
}

type RedisPubSub struct {
	client *redis.Client
}

func NewRedisPubSub(redisURL string) (*RedisPubSub, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis url: %w", err)
	}

	client := redis.NewClient(opts)
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return &RedisPubSub{client: client}, nil
}

func (r *RedisPubSub) Publish(ctx context.Context, topic string, payload []byte) error {
	return r.client.Publish(ctx, topic, payload).Err()
}

func (r *RedisPubSub) Subscribe(ctx context.Context, topics ...string) (Subscription, error) {
	subCtx, cancel := context.WithCancel(context.Background())
	ps := r.client.Subscribe(subCtx, topics...)

	sub := &RedisSubscription{
		pubsub: ps,
		ch:     make(chan *Message, 512),
		ctx:    subCtx,
		cancel: cancel,
	}

	go func() {
		defer close(sub.ch)
		msgCh := ps.Channel()
		for {
			select {
			case <-subCtx.Done():
				return
			case m, ok := <-msgCh:
				if !ok {
					return
				}
				select {
				case sub.ch <- &Message{Topic: m.Channel, Payload: []byte(m.Payload)}:
				case <-subCtx.Done():
					return
				default:
					// drop if full
				}
			}
		}
	}()

	return sub, nil
}

func (r *RedisPubSub) AddPresenceMember(ctx context.Context, appID, channelName, socketID, userID, userInfo string) error {
	key := fmt.Sprintf("aps:presence:%s:%s", appID, channelName)
	member := PresenceMember{
		UserID:   userID,
		UserInfo: userInfo,
		SocketID: socketID,
	}
	bytes, err := json.Marshal(member)
	if err != nil {
		return err
	}

	pipe := r.client.Pipeline()
	pipe.HSet(ctx, key, socketID, string(bytes))
	pipe.SAdd(ctx, fmt.Sprintf("aps:occupied:%s", appID), channelName)
	_, err = pipe.Exec(ctx)
	return err
}

func (r *RedisPubSub) RemovePresenceMember(ctx context.Context, appID, channelName, socketID string) (string, error) {
	key := fmt.Sprintf("aps:presence:%s:%s", appID, channelName)

	val, err := r.client.HGet(ctx, key, socketID).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		return "", err
	}

	var mem PresenceMember
	_ = json.Unmarshal([]byte(val), &mem)

	pipe := r.client.Pipeline()
	pipe.HDel(ctx, key, socketID)
	pipe.HLen(ctx, key)
	results, err := pipe.Exec(ctx)
	if err != nil {
		return mem.UserID, err
	}

	hlenCmd := results[1].(*redis.IntCmd)
	if hlenCmd.Val() == 0 {
		r.client.SRem(ctx, fmt.Sprintf("aps:occupied:%s", appID), channelName)
	}

	return mem.UserID, nil
}

func (r *RedisPubSub) GetPresenceMembers(ctx context.Context, appID, channelName string) (map[string]string, error) {
	key := fmt.Sprintf("aps:presence:%s:%s", appID, channelName)
	entries, err := r.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	res := make(map[string]string)
	for _, val := range entries {
		var mem PresenceMember
		if err := json.Unmarshal([]byte(val), &mem); err == nil {
			res[mem.UserID] = mem.UserInfo
		}
	}
	return res, nil
}

func (r *RedisPubSub) GetChannelOccupancy(ctx context.Context, appID, channelName string) (int, error) {
	key := fmt.Sprintf("aps:presence:%s:%s", appID, channelName)
	count, err := r.client.HLen(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

func (r *RedisPubSub) ListOccupiedChannels(ctx context.Context, appID, prefix string) ([]string, error) {
	key := fmt.Sprintf("aps:occupied:%s", appID)
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var res []string
	for _, ch := range members {
		if prefix == "" || strings.HasPrefix(ch, prefix) {
			res = append(res, ch)
		}
	}
	return res, nil
}

func (r *RedisPubSub) Close() error {
	return r.client.Close()
}
