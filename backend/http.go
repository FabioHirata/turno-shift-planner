package main

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const basePath = "/api/weeks/" + WeekID

type api struct {
	store  *Store
	static http.Handler
}

func newHandler(store *Store, webDir string) http.Handler {
	return &api{store: store, static: http.FileServer(http.Dir(webDir))}
}

type errorBody struct {
	Code            string `json:"code"`
	Message         string `json:"message"`
	CurrentRevision int64  `json:"currentRevision,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorBody{Code: code, Message: message})
}
func (a *api) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if !localHost(r.Host) {
		fail(w, 403, "host_not_allowed", "Use localhost or a loopback IP address.")
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if origin := r.Header.Get("Origin"); origin != "" {
				parsed, err := url.Parse(origin)
				scheme := "http"
				if r.TLS != nil {
					scheme = "https"
				}
				if err != nil || parsed.Scheme != scheme || parsed.Host != r.Host {
					fail(w, 403, "origin_not_allowed", "Only same-origin requests are accepted.")
					return
				}
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				fail(w, 403, "origin_not_allowed", "Cross-site requests are not accepted.")
				return
			}
		}
		a.serveAPI(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		fail(w, 405, "method_not_allowed", "Static resources are read-only.")
		return
	}
	for _, segment := range strings.Split(r.URL.Path, "/") {
		if strings.HasPrefix(segment, ".") {
			http.NotFound(w, r)
			return
		}
	}
	a.static.ServeHTTP(w, r)
}
func localHost(host string) bool {
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	if strings.EqualFold(host, "localhost") {
		return true
	}
	return net.ParseIP(strings.Trim(host, "[]")).IsLoopback()
}
func decodeBody(w http.ResponseWriter, r *http.Request, target any) bool {
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		fail(w, 415, "content_type", "Content-Type must be application/json.")
		return false
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 65536))
	if err != nil {
		fail(w, 413, "body_too_large", "Request body exceeds the 64 KiB limit.")
		return false
	}
	if err = decodeStrict(data, target); err != nil {
		fail(w, 400, "invalid_json", "A single JSON object with known fields is required.")
		return false
	}
	return true
}
func revisionOK(w http.ResponseWriter, revision *int64) bool {
	if revision == nil || *revision < 1 || *revision > MaxRevision {
		fail(w, 422, "invalid_revision", "A positive safe integer revision is required.")
		return false
	}
	return true
}
func (a *api) update(w http.ResponseWriter, revision int64, mutate func(*State) error) {
	state, err := a.store.Update(revision, mutate)
	switch {
	case errors.Is(err, ErrRevision):
		writeJSON(w, 409, errorBody{Code: "revision_conflict", Message: "State changed. Reload and review before retrying.", CurrentRevision: state.Revision})
	case err != nil:
		fail(w, 500, "storage_error", "The update could not be committed. Reload before retrying.")
	default:
		writeJSON(w, 200, response(state))
	}
}
func methodNotAllowed(w http.ResponseWriter, allow string) {
	w.Header().Set("Allow", allow)
	fail(w, 405, "method_not_allowed", "Unsupported method for this resource.")
}
func (a *api) serveAPI(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/health" {
		if r.Method != "GET" {
			methodNotAllowed(w, "GET")
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok", "storage": "json-file", "mode": "local-demo"})
		return
	}
	if r.URL.Path == basePath {
		switch r.Method {
		case "GET":
			writeJSON(w, 200, response(a.store.Get()))
		case "PUT":
			var body struct {
				Revision     *int64       `json:"revision"`
				Assignments  Assignments  `json:"assignments"`
				Availability Availability `json:"availability"`
			}
			if !decodeBody(w, r, &body) || !revisionOK(w, body.Revision) {
				return
			}
			candidate := State{1, *body.Revision, WeekID, body.Assignments, body.Availability}
			if err := validate(candidate); err != nil {
				fail(w, 422, "invalid_state", err.Error())
				return
			}
			a.update(w, *body.Revision, func(s *State) error {
				s.Assignments = candidate.Assignments
				s.Availability = candidate.Availability
				return nil
			})
		default:
			methodNotAllowed(w, "GET, PUT")
		}
		return
	}
	if r.URL.Path == basePath+"/assignments" {
		if r.Method != "PATCH" {
			methodNotAllowed(w, "PATCH")
			return
		}
		var body struct {
			Revision *int64 `json:"revision"`
			PersonID string `json:"personId"`
			Day      *int   `json:"day"`
			Shift    string `json:"shift"`
		}
		if !decodeBody(w, r, &body) || !revisionOK(w, body.Revision) {
			return
		}
		if !knownPerson(body.PersonID) || body.Day == nil || !validDay(*body.Day) || !validShift(body.Shift) {
			fail(w, 422, "invalid_assignment", "A known person, day 0–6 and shift off/morning/afternoon are required.")
			return
		}
		a.update(w, *body.Revision, func(s *State) error { s.Assignments[body.PersonID][*body.Day] = body.Shift; return nil })
		return
	}
	if strings.HasPrefix(r.URL.Path, basePath+"/assignments/") {
		if r.Method != "DELETE" {
			methodNotAllowed(w, "DELETE")
			return
		}
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, basePath+"/assignments/"), "/")
		if len(parts) != 2 || !knownPerson(parts[0]) {
			fail(w, 404, "not_found", "Assignment not found.")
			return
		}
		day, err := strconv.Atoi(parts[1])
		if err != nil || !validDay(day) || strconv.Itoa(day) != parts[1] {
			fail(w, 422, "invalid_day", "Day must be 0 through 6.")
			return
		}
		q, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil || len(q) != 1 || len(q["revision"]) != 1 {
			fail(w, 422, "invalid_revision", "A single revision query parameter is required.")
			return
		}
		revision, err := strconv.ParseInt(q.Get("revision"), 10, 64)
		if err != nil || !revisionOK(w, &revision) {
			if err != nil {
				fail(w, 422, "invalid_revision", "Invalid revision.")
			}
			return
		}
		a.update(w, revision, func(s *State) error { s.Assignments[parts[0]][day] = "off"; return nil })
		return
	}
	if r.URL.Path == basePath+"/availability" {
		if r.Method != "PUT" {
			methodNotAllowed(w, "PUT")
			return
		}
		var body struct {
			Revision *int64   `json:"revision"`
			PersonID string   `json:"personId"`
			Day      *int     `json:"day"`
			Shifts   []string `json:"shifts"`
		}
		if !decodeBody(w, r, &body) || !revisionOK(w, body.Revision) {
			return
		}
		if !knownPerson(body.PersonID) || body.Day == nil || !validDay(*body.Day) || validateBlocked(body.Shifts) != nil {
			fail(w, 422, "invalid_availability", "Use a known person, day 0–6 and distinct morning/afternoon shifts (or an empty array).")
			return
		}
		a.update(w, *body.Revision, func(s *State) error { s.Availability[body.PersonID][strconv.Itoa(*body.Day)] = body.Shifts; return nil })
		return
	}
	if r.URL.Path == basePath+"/reset" {
		if r.Method != "POST" {
			methodNotAllowed(w, "POST")
			return
		}
		var body struct {
			Revision *int64 `json:"revision"`
		}
		if !decodeBody(w, r, &body) || !revisionOK(w, body.Revision) {
			return
		}
		a.update(w, *body.Revision, func(s *State) error {
			initial := demo()
			s.Assignments = initial.Assignments
			s.Availability = initial.Availability
			return nil
		})
		return
	}
	fail(w, 404, "not_found", "Unknown API resource. This demo supports only week "+WeekID+".")
}
