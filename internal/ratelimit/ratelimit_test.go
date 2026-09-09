package ratelimit

import (
	"testing"
	"time"
)

func TestTokenBucketLimiter(t *testing.T) {
	lim := NewLimiter(10, 2) // 10 tokens/sec, capacity 2

	if !lim.Allow() {
		t.Fatalf("Expected 1st token to be allowed")
	}
	if !lim.Allow() {
		t.Fatalf("Expected 2nd token to be allowed")
	}
	if lim.Allow() {
		t.Fatalf("Expected 3rd token to be rejected without delay")
	}

	time.Sleep(120 * time.Millisecond)
	if !lim.Allow() {
		t.Fatalf("Expected token to be replenished after wait")
	}
}
