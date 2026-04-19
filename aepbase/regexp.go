package main

import (
	"database/sql/driver"
	"fmt"
	"regexp"
	"sync"

	sqlite "modernc.org/sqlite"
)

// SQLite's `X REGEXP Y` operator dispatches to a 2-arg user function named
// `regexp` with arguments (pattern, value). The modernc.org/sqlite driver
// doesn't ship one, so we register it here. Registration is global to the
// "sqlite" driver and must happen before any connection is opened, which is
// why this lives in an init().
func init() {
	var cache sync.Map // map[string]regexpCacheEntry

	sqlite.MustRegisterDeterministicScalarFunction(
		"regexp",
		2,
		func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			pattern, ok := args[0].(string)
			if !ok {
				return nil, fmt.Errorf("regexp: pattern must be text, got %T", args[0])
			}
			value, ok := args[1].(string)
			if !ok {
				if b, isBytes := args[1].([]byte); isBytes {
					value = string(b)
				} else {
					return nil, fmt.Errorf("regexp: value must be text, got %T", args[1])
				}
			}

			re, err := compile(&cache, pattern)
			if err != nil {
				return nil, err
			}
			return re.MatchString(value), nil
		},
	)
}

type regexpCacheEntry struct {
	re  *regexp.Regexp
	err error
}

func compile(cache *sync.Map, pattern string) (*regexp.Regexp, error) {
	if v, ok := cache.Load(pattern); ok {
		entry := v.(regexpCacheEntry)
		return entry.re, entry.err
	}
	re, err := regexp.Compile(pattern)
	cache.Store(pattern, regexpCacheEntry{re: re, err: err})
	return re, err
}
