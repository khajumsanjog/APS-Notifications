package ratelimit

import (
	"sync"
	"time"
)

type Limiter struct {
	rate       float64 // tokens per second
	capacity   float64 // max burst
	tokens     float64
	lastUpdate time.Time
	mu         sync.Mutex
}

func NewLimiter(rate, capacity float64) *Limiter {
	return &Limiter{
		rate:       rate,
		capacity:   capacity,
		tokens:     capacity,
		lastUpdate: time.Now(),
	}
}

func (l *Limiter) Allow() bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(l.lastUpdate).Seconds()
	l.lastUpdate = now

	// Refill tokens
	l.tokens += elapsed * l.rate
	if l.tokens > l.capacity {
		l.tokens = l.capacity
	}

	if l.tokens >= 1.0 {
		l.tokens -= 1.0
		return true
	}

	return false
}

type KeyedLimiter struct {
	rate     float64
	capacity float64
	limiters map[string]*Limiter
	mu       sync.RWMutex
}

func NewKeyedLimiter(rate, capacity float64) *KeyedLimiter {
	return &KeyedLimiter{
		rate:     rate,
		capacity: capacity,
		limiters: make(map[string]*Limiter),
	}
}

func (kl *KeyedLimiter) Allow(key string) bool {
	kl.mu.RLock()
	lim, exists := kl.limiters[key]
	kl.mu.RUnlock()

	if !exists {
		kl.mu.Lock()
		lim, exists = kl.limiters[key]
		if !exists {
			lim = NewLimiter(kl.rate, kl.capacity)
			kl.limiters[key] = lim
		}
		kl.mu.Unlock()
	}

	return lim.Allow()
}
