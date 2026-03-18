/**
 * SPACE: Smart Scheduling Application with AI Chat & Maps
 * Main application logic for calendar, events, location mapping, and chat functionality
 * Uses OpenStreetMap (Leaflet) for free location selection and Nominatim for geocoding
 */
(function () {
  // ============================================
  // DOM ELEMENT REFERENCES
  // ============================================
  
  // Calendar UI elements
  const calendarGrid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");
  
  // Event form elements
  const eventForm = document.getElementById("eventForm");
  const placeInput = document.getElementById("placeInput");
  
  // Map picker modal elements
  const mapModal = document.getElementById("mapModal");
  const mapContainer = document.getElementById("mapContainer");
  const mapSearchInput = document.getElementById("mapSearchInput");
  const mapSelectBtn = document.getElementById("mapSelectBtn");
  const closeMap = document.getElementById("closeMap");
  
  // Form preview map element
  const formMapPreview = document.getElementById("formMapPreview");

  // ============================================
  // MAP STATE VARIABLES
  // ============================================
  
  let map = null;                              // Leaflet map instance
  let marker = null;                           // Current map marker (draggable)
  let selectedPlace = null;                    // Selected location name from search
  let autocomplete = null;                     // Unused (legacy Google Maps reference)
  let placesService = null;                    // Unused (legacy Google Maps reference)
  let currentEventLocation = { lat: null, lng: null }; // Store location coordinates for event form

  // ============================================
  // MAP INITIALIZATION & LOCATION FUNCTIONS
  // ============================================
  
  /**
   * Initialize OpenStreetMap (Leaflet) for location selection
   * Default location: Catbalogan, Samar (user's preferred city)
   * Features: Draggable marker, tile layer, search functionality
   */
  function initMap() {
    const defaultLocation = [11.7945, 124.6487]; // Catbalogan, Samar coordinates

    try {
      // Clean up existing map instance if present
      if (map) {
        map.off();
        map.remove();
      }

      // Create new map centered on default location at zoom level 13
      map = L.map(mapContainer).setView(defaultLocation, 13);

      // Add OpenStreetMap tiles layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add draggable marker for location selection
      marker = L.marker(defaultLocation, { draggable: true }).addTo(map);

      // Update location when marker is dragged
      marker.on('dragend', function() {
        const position = marker.getLatLng();
        map.setView(position, map.getZoom());
        reverseGeocode(position.lat, position.lng);
      });

      // Search input: press Enter to search location by name
      mapSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          searchLocation(mapSearchInput.value);
        }
      });

      selectedPlace = null;
      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Map initialization error:', error);
      mapContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:16px;">⚠️ Map failed to load<br>Please check your internet connection</div>';
    }
  }
  async function searchLocation(query) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const results = await response.json();
      
      if (results.length > 0) {
        const place = results[0];
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        
        // Center map and move marker to found location
        map.setView([lat, lng], 15);
        marker.setLatLng([lat, lng]);
        
        // Store selected place with coordinates
        selectedPlace = {
          name: place.name,
          address: place.display_name,
          lat: lat,
          lng: lng,
        };
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  /**
   * Get address from coordinates using Nominatim reverse geocoding
   * Called when marker is dragged to new position
   * @param {number} lat - Latitude coordinate
   * @param {number} lng - Longitude coordinate
   */
  async function reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const result = await response.json();
      
      // Store reverse geocoded place data with coordinates
      selectedPlace = {
        name: result.address?.name || 'Location',
        address: result.display_name,
        lat: lat,
        lng: lng,
      };
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Convert 24-hour time format to 12-hour AM/PM format
   * @param {string} time24 - Time in format "HH:MM" (e.g., "14:30")
   * @returns {string} Time in format "h:MM AM/PM" (e.g., "2:30 PM")
   */
  function formatTime(time24) {
    const [hours, minutes] = time24.split(":");
    let h = parseInt(hours);
    const m = minutes;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return h + ":" + m + " " + ampm;
  }

  // ============================================
  // DATA STORAGE & INITIALIZATION
  // ============================================
  
  // Load events and history from localStorage, initialize calendar view
  let events = JSON.parse(localStorage.getItem("sched_events") || "[]");
  let history = JSON.parse(localStorage.getItem("sched_history") || "[]");
  let view = new Date();
  view.setDate(1); // Start view from first day of month
  const reminderTimers = new Map(); // Track reminder countdown timers
  const notificationTimers = new Map(); // Track notification popup timers

  /**
   * Save events to localStorage and refresh UI
   * Also triggers reminder and notification scheduling
   */
  function saveEvents() {
    localStorage.setItem("sched_events", JSON.stringify(events));
    renderCalendar();
    scheduleAllReminders();
    scheduleAllNotifications();
  }
  
  /**
   * Save history (completed/cancelled events) to localStorage
   */
  function saveHistory() {
    localStorage.setItem("sched_history", JSON.stringify(history));
    renderHistory();
  }

  /**
   * Render history UI with tabs for confirmed and cancelled events
   * Creates maps for each event showing the location
   * Maps display exact coordinates if stored, otherwise auto-geocode by place name
   */
  function renderHistory() {
    const confirmedList = document.getElementById("confirmedList");
    const cancelledList = document.getElementById("cancelledList");
    confirmedList.innerHTML = "";
    cancelledList.innerHTML = "";
    
    // Filter events into confirmed and cancelled lists
    const confirmed = history.filter((h) => h.status === "confirmed");
    const cancelled = history.filter((h) => h.status === "cancelled");

    // Show "No recent history" if both tabs are empty
    if (!confirmed.length && !cancelled.length) {
      confirmedList.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--muted);font-size:16px">📭 No recent history schedule</div>';
      cancelledList.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--muted);font-size:16px">📭 No recent history schedule</div>';
      return;
    }

    // Show empty state for each tab if no events
    if (!confirmed.length)
      confirmedList.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted)">No confirmed schedules</div>';
    if (!cancelled.length)
      cancelledList.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted)">No cancelled schedules</div>';
    
    // Render confirmed events with maps
    confirmed.forEach((h, index) => {
      const placeText = h.place ? ` 📍 ${h.place}` : '';
      let cardHtml = `<div class="history-card"><h4>${h.title}</h4><p>${h.date} ${formatTime(h.time)}${placeText}</p><span class="status confirmed">✓</span>`;
      
      // Add map container for events with location (coordinates or place name for geocoding)
      if (h.place) {
        cardHtml += `<div id="confirmedMap${index}" style="width:100%;height:180px;margin-top:10px;border-radius:6px;overflow:hidden;border:1px solid var(--border)"></div>`;
      }
      cardHtml += `</div>`;
      
      confirmedList.innerHTML += cardHtml;
    });
    
    // Render cancelled events with maps
    cancelled.forEach((h, index) => {
      const placeText = h.place ? ` 📍 ${h.place}` : '';
      let cardHtml = `<div class="history-card"><h4>${h.title}</h4><p>${h.date} ${formatTime(h.time)}${placeText}</p><span class="status cancelled">✗</span>`;
      
      // Add map container for cancelled events with location
      if (h.place) {
        cardHtml += `<div id="cancelledMap${index}" style="width:100%;height:180px;margin-top:10px;border-radius:6px;overflow:hidden;border:1px solid var(--border)"></div>`;
      }
      cardHtml += `</div>`;
      
      cancelledList.innerHTML += cardHtml;
    });
    
    // Initialize maps for history events - moved to separate function
    // This is now called after the modal is shown
  }

  /**
   * Initialize maps for history events after modal is displayed
   * Called with delay to ensure DOM elements are ready
   */
  function initializeHistoryMaps() {
    // Initialize maps for confirmed events
    history.filter(h => h.status === "confirmed").forEach((h, index) => {
      const mapElement = document.getElementById(`confirmedMap${index}`);
      if (mapElement && !mapElement.hasChildNodes()) { // Only initialize if not already initialized
        if (h.lat && h.lng) {
          // Use exact coordinates
          setTimeout(() => initializeHistoryMap(mapElement, h.lat, h.lng, h.place, `confirmedMap${index}`), 100 + (index * 50));
        } else if (h.place) {
          // Geocode the place name
          setTimeout(() => geocodeAndShowHistoryMap(h.place, mapElement, `confirmedMap${index}`), 100 + (index * 50));
        }
      }
    });
    
    // Initialize maps for cancelled events
    history.filter(h => h.status === "cancelled").forEach((h, index) => {
      const mapElement = document.getElementById(`cancelledMap${index}`);
      if (mapElement && !mapElement.hasChildNodes()) { // Only initialize if not already initialized
        if (h.lat && h.lng) {
          // Use exact coordinates
          setTimeout(() => initializeHistoryMap(mapElement, h.lat, h.lng, h.place, `cancelledMap${index}`), 100 + (index * 50));
        } else if (h.place) {
          // Geocode the place name
          setTimeout(() => geocodeAndShowHistoryMap(h.place, mapElement, `cancelledMap${index}`), 100 + (index * 50));
        }
      }
    });
  }

  // Initialize a map for history event with exact coordinates
  function initializeHistoryMap(mapElement, lat, lng, placeName, mapId) {
    try {
      mapElement.innerHTML = '';
      const historyMap = L.map(mapElement).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(historyMap);
      
      const marker = L.marker([lat, lng]).addTo(historyMap);
      marker.bindPopup(`<strong>${placeName}</strong>`);
      console.log(`${mapId} initialized at:`, lat, lng);
    } catch (error) {
      console.error(`${mapId} error:`, error);
    }
  }

  // Geocode place name and show map
  async function geocodeAndShowHistoryMap(placeName, mapElement, mapId) {
    // Skip geocoding if place name is empty or too short
    if (!placeName || placeName.trim().length < 2) {
      console.warn(`${mapId}: Place name too short or empty: "${placeName}"`);
      mapElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px;">📍 No location specified</div>';
      return;
    }

    try {
      // First try: Search with the exact place name
      let response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName.trim())}&limit=1&addressdetails=1`
      );
      let results = await response.json();

      // If no results, try a broader search by adding "Philippines" for local context
      if (results.length === 0 && !placeName.toLowerCase().includes('philippines')) {
        console.log(`${mapId}: Trying broader search for "${placeName}"`);
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName.trim() + ', Philippines')}&limit=1&addressdetails=1`
        );
        results = await response.json();
      }

      // If still no results, try searching for landmarks or common places
      if (results.length === 0) {
        const commonPlaces = ['catbalogan', 'samar', 'philippines'];
        for (const fallback of commonPlaces) {
          if (placeName.toLowerCase().includes(fallback)) {
            console.log(`${mapId}: Using fallback location for "${placeName}"`);
            response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallback)}&limit=1`
            );
            results = await response.json();
            break;
          }
        }
      }

      if (results.length > 0) {
        const place = results[0];
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);

        try {
          // Clear container and initialize new Leaflet map instance
          mapElement.innerHTML = '';
          const historyMap = L.map(mapElement).setView([lat, lng], 15);

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(historyMap);

          // Add marker with popup showing location name
          const marker = L.marker([lat, lng]).addTo(historyMap);
          marker.bindPopup(`<strong>${placeName}</strong>`).openPopup();
          console.log(`${mapId} geocoded and initialized at:`, lat, lng);
        } catch (error) {
          console.error(`${mapId} error:`, error);
        }
      } else {
        console.warn(`${mapId}: Could not geocode "${placeName}" - showing default location`);
        // Show default location (Catbalogan, Samar) as fallback
        try {
          mapElement.innerHTML = '';
          const historyMap = L.map(mapElement).setView([11.7945, 124.6487], 13);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(historyMap);

          const marker = L.marker([11.7945, 124.6487]).addTo(historyMap);
          marker.bindPopup(`<strong>Catbalogan, Samar (Default Location)</strong><br><small>Could not find: ${placeName}</small>`).openPopup();
          console.log(`${mapId}: Showing default location for "${placeName}"`);
        } catch (error) {
          console.error(`${mapId} fallback map error:`, error);
          mapElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px;">📍 Location not found</div>';
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      // Try to show a basic fallback map
      try {
        mapElement.innerHTML = '';
        const historyMap = L.map(mapElement).setView([11.7945, 124.6487], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(historyMap);

        const marker = L.marker([11.7945, 124.6487]).addTo(historyMap);
        marker.bindPopup(`<strong>Catbalogan, Samar</strong><br><small>Network error - showing default location</small>`).openPopup();
      } catch (fallbackError) {
        mapElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px;">⚠️ Map unavailable</div>';
      }
    }
  }

  /**
   * Render calendar grid for current month view
   * Shows calendar dates and event indicators for each day
   * Allows clicking dates to view/add events
   */
  function renderCalendar() {
    calendarGrid.innerHTML = "";
    const year = view.getFullYear();
    const month = view.getMonth();
    
    // Display month and year at top of calendar
    monthLabel.textContent = view.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
    
    // Calculate first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Adjust firstDay for Monday start (JavaScript: Sunday=0, we want Monday=0)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    // Add blank cells for days before month starts
    for (let i = 0; i < adjustedFirstDay; i++) {
      const blank = document.createElement("div");
      blank.className = "cell";
      calendarGrid.appendChild(blank);
    }

    // Add date cells with event indicators
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      
      // Date number (top left of cell)
      const dateDiv = document.createElement("div");
      dateDiv.className = "date";
      dateDiv.textContent = d;
      cell.appendChild(dateDiv);
      
      // Get events for this date (ISO format: YYYY-MM-DD)
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const todays = events.filter((e) => e.date === iso);
      
      // Add event indicators for each event on this date
      todays.forEach((ev) => {
        const dot = document.createElement("div");
        dot.className = "event-dot";
        dot.textContent = formatTime(ev.time) + " — " + ev.title;
        cell.appendChild(dot);
      });
      cell.addEventListener("click", () => {
        showViewScheduleModal(iso);
      });
      calendarGrid.appendChild(cell);
    }
  }

  prevBtn.addEventListener("click", () => {
    view.setMonth(view.getMonth() - 1);
    renderCalendar();
  });
  nextBtn.addEventListener("click", () => {
    view.setMonth(view.getMonth() + 1);
    renderCalendar();
  });

  /**
   * Display modal with all events for a specific date
   * Shows event details (time, title, location) with individual maps
   * Maps display at exact coordinates if stored, or default location otherwise
   * @param {string} iso - Date in ISO format (YYYY-MM-DD)
   */
  function showViewScheduleModal(iso) {
    const modal = document.getElementById("viewScheduleModal");
    const dateDisplay = document.getElementById("viewScheduleDate");
    const contentArea = document.getElementById("viewScheduleContent");
    const viewScheduleMapContainer = document.getElementById("viewScheduleMapContainer");
    
    // Get all events scheduled for this date
    const schedules = events.filter((e) => e.date === iso);

    // Format date for display (e.g., "Monday, January 15, 2024")
    const dateObj = new Date(iso + "T00:00:00");
    const dateStr = dateObj.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    dateDisplay.textContent = dateStr;

    if (schedules.length === 0) {
      // Show empty state if no events
      contentArea.innerHTML =
        '<div class="no-schedule">📭 No schedule here</div>';
      viewScheduleMapContainer.style.display = 'none';
    } else {
      // Create HTML for all events with their maps embedded
      let html = '';
      schedules.forEach((ev, index) => {
        html += `
          <div class="schedule-item">
            <h4>⏰ ${formatTime(ev.time)}</h4>
            <h4>${ev.title}</h4>
            ${ev.place ? `<p>📍 ${ev.place}</p>` : ""}
            ${ev.lat && ev.lng ? `<div id="eventMap${index}" style="width:100%;height:280px;margin-top:10px;border-radius:6px;overflow:hidden;border:1px solid var(--border)"></div>` : ""}
          </div>
        `;
      });
      contentArea.innerHTML = html;
      
      // Initialize maps for each event that has coordinates
      schedules.forEach((ev, index) => {
        if (ev.lat && ev.lng) {
          const mapElement = document.getElementById(`eventMap${index}`);
          if (mapElement) {
            // Stagger initialization with delays to prevent race conditions
            setTimeout(() => {
              try {
                // Clear container and initialize new map
                mapElement.innerHTML = '';
                const eventMap = L.map(mapElement).setView([ev.lat, ev.lng], 16);
                
                // Add OpenStreetMap tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 19,
                }).addTo(eventMap);
                
                // Add marker with location popup
                const marker = L.marker([ev.lat, ev.lng]).addTo(eventMap);
                marker.bindPopup(`<strong>${ev.place}</strong>`).openPopup();
                console.log(`Map ${index} initialized at:`, ev.lat, ev.lng);
              } catch (error) {
                console.error(`Map ${index} error:`, error);
              }
            }, 100 * (index + 1)); // Stagger by 100ms per event
          }
        }
      });
      
      // Hide the old container since we're embedding maps in each event
      viewScheduleMapContainer.style.display = 'none';
    }
    modal.setAttribute("aria-hidden", "false");
  }

  /**
   * Search location by query and display on provided map
   * Used during event creation to find and verify location
   * Falls back to default Catbalogan if no query provided
   * @param {string} query - Location name to search for
   * @param {L.map} eventMap - Leaflet map instance to update
   */
  async function searchLocationForMap(query, eventMap) {
    try {
      const searchQuery = query.trim();
      if (!searchQuery) {
        // If no place specified, use default Catbalogan location
        eventMap.setView([11.7945, 124.6487], 15);
        L.marker([11.7945, 124.6487]).addTo(eventMap).bindPopup('Catbalogan, Samar');
        return;
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const results = await response.json();
      
      if (results.length > 0) {
        const place = results[0];
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        
        console.log('Found location:', place.display_name);
        eventMap.setView([lat, lng], 15);
        L.marker([lat, lng]).addTo(eventMap).bindPopup(place.display_name).openPopup();
      } else {
        console.log('Location not found, using default');
        // If location not found, use default
        eventMap.setView([11.7945, 124.6487], 15);
        L.marker([11.7945, 124.6487]).addTo(eventMap).bindPopup('Catbalogan, Samar');
      }
    } catch (error) {
      console.error('Map search error:', error);
      // Fallback to default location
      eventMap.setView([11.7945, 124.6487], 15);
      L.marker([11.7945, 124.6487]).addTo(eventMap).bindPopup('Catbalogan, Samar');
    }
  }

  function scheduleReminderForEvent(ev) {
    if (reminderTimers.has(ev.id)) {
      clearTimeout(reminderTimers.get(ev.id));
      reminderTimers.delete(ev.id);
    }
    
    // Parse date and time to create event time Date object
    const [hours, minutes] = ev.time.split(":");
    const eventTime = new Date(ev.date + "T" + hours.padStart(2, "0") + ":" + minutes.padStart(2, "0") + ":00");
    const remindAt = new Date(eventTime.getTime() - 5 * 60 * 1000); // 5 minutes before event
    const now = new Date();
    const ms = remindAt - now;
    
    // Skip if reminder time has already passed
    if (ms <= 0) return;
    
    // Schedule reminder timeout
    const tid = setTimeout(() => {
      sendReminder(ev);
      reminderTimers.delete(ev.id);
    }, ms);
    reminderTimers.set(ev.id, tid);
  }

  /**
   * Schedule notification popup to show at exact event time
   * Displays modal with event details and map (if available)
   * Sound plays automatically at notification time
   * @param {Object} ev - Event object with date, time, title, place, coordinates
   */
  function scheduleNotificationForEvent(ev) {
    // Clear existing timer if already scheduled
    if (notificationTimers.has(ev.id)) {
      clearTimeout(notificationTimers.get(ev.id));
      notificationTimers.delete(ev.id);
    }
    
    // Parse date and time to create event time Date object
    const [hours, minutes] = ev.time.split(":");
    const eventTime = new Date(ev.date + "T" + hours.padStart(2, "0") + ":" + minutes.padStart(2, "0") + ":00");
    const now = new Date();
    const ms = eventTime - now;
    
    console.log(`Scheduling notification for ${ev.title}: scheduled at ${eventTime}, now: ${now}, ms: ${ms}`);
    
    // Skip if event time has already passed
    if (ms <= 0) {
      console.log(`Event time already passed, skipping notification for ${ev.title}`);
      return;
    }
    
    // Schedule notification to trigger at event time
    const tid = setTimeout(() => {
      console.log(`Notification triggered for ${ev.title}`);
      showNotification(ev);
      notificationTimers.delete(ev.id);
    }, ms);
    notificationTimers.set(ev.id, tid);
  }

  /**
   * Schedule notifications for all events
   * Clears existing timers and reschedules all events
   */
  function scheduleAllNotifications() {
    notificationTimers.forEach((tid) => clearTimeout(tid));
    notificationTimers.clear();
    events.forEach((ev) => scheduleNotificationForEvent(ev));
  }

  let currentNotificationSound = null; // Store currently playing audio object

  /**
   * Play alarm sound for event notification
   * Only one sound can play at a time (stops previous sound if playing)
   * @param {boolean} shouldPlay - Whether to actually play sound (true) or just prepare (false)
   */
  function playNotificationSound(shouldPlay = true) {
    // Stop any currently playing audio first
    if (currentNotificationSound) {
      currentNotificationSound.pause();
      currentNotificationSound.currentTime = 0;
    }
    
    // Only play sound if shouldPlay is true
    if (!shouldPlay) return;
    
    try {
      const audio = new Audio('Alarm clock sound.mp3');
      audio.volume = 0.5; // Set volume to 50%
      currentNotificationSound = audio; // Store reference for later stopping
      audio.play().catch((error) => {
        console.log("Could not play audio:", error);
      });
    } catch (e) {
      console.log("Audio not supported:", e);
    }
  }

  /**
   * Stop currently playing notification sound
   * Called when user confirms or cancels notification
   */
  function stopNotificationSound() {
    if (currentNotificationSound) {
      currentNotificationSound.pause();
      currentNotificationSound.currentTime = 0;
      currentNotificationSound = null;
    }
  }

  /**
   * Display notification modal for event at notification time
   * Shows event details (time, title, place) and map if location available
   * Includes confirm/cancel buttons for user response
   * @param {Object} ev - Event object to display
   */
  function showNotification(ev) {
    // Play notification sound
    playNotificationSound();
    
    const notifModal = document.getElementById("notificationModal");
    const notifContent = document.getElementById("notificationContent");
    const placeText = ev.place ? `<div style="margin-top:8px">📍 ${ev.place}</div>` : '';
    notifContent.innerHTML = `<strong style="font-size:16px">⏰ Confirmation</strong><div style="margin-top:12px;font-size:15px">You have schedule:</div><div style="margin-top:8px;font-weight:600;color:var(--accent)">${ev.title}</div><div style="margin-top:8px">📅 ${ev.date}</div><div>⏰ ${formatTime(ev.time)}</div>${placeText}<div style="margin-top:12px;color:var(--muted)">Can you confirm this schedule?</div>`;
    notifModal.setAttribute("aria-hidden", "false");
    currentNotificationEvent = ev;
  }

  function scheduleAllReminders() {
    // clear all
    reminderTimers.forEach((tid) => clearTimeout(tid));
    reminderTimers.clear();
    events.forEach((ev) => scheduleReminderForEvent(ev));
  }

  async function sendReminder(ev) {
    // Play notification sound
    playNotificationSound();
    
    const title = `⏰ Reminder`;
    const body = `You have schedule "${ev.title}" on ${ev.date} at ${formatTime(ev.time)}`;

    // Show desktop notification only (no modal)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (
      "Notification" in window &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body });
      });
    }

    showToast("⏰ Reminder: " + ev.title);
  }

  function showToast(msg, timeout = 6000) {
    const t = document.createElement("div");
    t.className = "toast";
    
    // Add styling based on message type
    if (msg.includes("Saved")) {
      t.style.borderColor = "#10b981";
      t.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))";
    } else if (msg.includes("cancelled")) {
      t.style.borderColor = "#ef4444";
      t.style.background = "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))";
    } else if (msg.includes("Reminder")) {
      t.style.borderColor = "#3b82f6";
      t.style.background = "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))";
    }
    
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 400);
    }, timeout);
  }

  // Notification Modal Handlers
  const notificationModal = document.getElementById("notificationModal");
  const thankYouModal = document.getElementById("thankYouModal");
  const confirmBtn = document.getElementById("confirmBtn");
  const cancelNotifyBtn = document.getElementById("cancelNotifyBtn");
  const closeThankYou = document.getElementById("closeThankYou");

  let currentNotificationEvent = null;

  confirmBtn.addEventListener("click", () => {
    stopNotificationSound(); // Stop the sound immediately
    if (!currentNotificationEvent) return;
    const ev = currentNotificationEvent;
    history.push({
      id: Date.now(),
      title: ev.title,
      date: ev.date,
      time: ev.time,
      place: ev.place,
      lat: ev.lat,
      lng: ev.lng,
      status: "confirmed",
    });
    events = events.filter((e) => e.id !== ev.id);
    saveEvents();
    saveHistory();
    notificationModal.setAttribute("aria-hidden", "true");
    thankYouModal.setAttribute("aria-hidden", "false");
    eventForm.reset();
    currentNotificationEvent = null;
  });

  cancelNotifyBtn.addEventListener("click", () => {
    stopNotificationSound(); // Stop the sound immediately
    if (!currentNotificationEvent) return;
    const ev = currentNotificationEvent;
    history.push({
      id: Date.now(),
      title: ev.title,
      date: ev.date,
      time: ev.time,
      place: ev.place,
      lat: ev.lat,
      lng: ev.lng,
      status: "cancelled",
    });
    events = events.filter((e) => e.id !== ev.id);
    saveEvents();
    saveHistory();
    notificationModal.setAttribute("aria-hidden", "true");
    showToast("Schedule cancelled");
    currentNotificationEvent = null;
  });

  closeThankYou.addEventListener("click", () => {
    thankYouModal.setAttribute("aria-hidden", "true");
  });
  document.getElementById("closeViewSchedule").addEventListener("click", () => {
    document
      .getElementById("viewScheduleModal")
      .setAttribute("aria-hidden", "true");
  });

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(eventForm);
    const ev = {
      id: Date.now(),
      title: fd.get("title"),
      date: fd.get("date"),
      time: fd.get("time"),
      place: fd.get("place") || "",
      lat: currentEventLocation.lat,
      lng: currentEventLocation.lng,
    };
    console.log('Saving event with location:', ev);
    events.push(ev);
    saveEvents();
    eventForm.reset();
    // Reset location for next event
    currentEventLocation = { lat: null, lng: null };
    selectedPlace = null;
    showToast("Saved: " + ev.title);
  });

  document
    .getElementById("clearBtn")
    .addEventListener("click", () => eventForm.reset());

  // AI Chat guided flow (scheduling-focused)
  const chatModal = document.getElementById("chatModal");
  const chatBtn = document.getElementById("chatBtn");
  const closeChat = document.getElementById("closeChat");
  const chatLog = document.getElementById("chatLog");
  const chatInput = document.getElementById("chatInput");
  const sendChat = document.getElementById("sendChat");
  const voiceBtn = document.getElementById("voiceBtn");

  // Speech Recognition API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      voiceBtn.classList.add('listening');
      voiceBtn.textContent = '🔴';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      chatInput.value = transcript;
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove('listening');
      voiceBtn.textContent = '🎤';
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      voiceBtn.classList.remove('listening');
      voiceBtn.textContent = '🎤';
      pushAI('Sorry, I couldn\'t understand. Please try again or use text.');
    };

    // Voice input button: click to start/stop listening
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (isListening) {
          recognition.stop();
        } else {
          chatInput.value = '';
          recognition.start();
        }
      });
    }
  }

  // ============================================
  // CHAT SYSTEM & AI INTEGRATION
  // ============================================
  
  // chatState tracks conversation flow:
  // step 0 = idle (awaiting command: 'create' or 'search')
  // step 1 = create event: ask for title
  // step 2 = create event: ask for date
  // step 3 = create event: ask for time
  // step 4 = create event: ask for place, show map button
  // step 5 = create event: confirm save
  // step 200 = search: ask for event title to search
  // step 201 = search: show search results
  let chatState = { step: 0, draft: {} }; // Current conversation state

  /**
   * Display AI response message in chat
   * Can optionally include a "Select Location" button for place selection during event creation
   * @param {string} text - Message to display
   * @param {boolean} showMapButton - Whether to show location selection button (used in step 4)
   */
  function pushAI(text, showMapButton = false) {
    const msgRow = document.createElement("div");
    msgRow.className = "chat-msg-row ai-row";
    
    // Add AI avatar image
    const avatar = document.createElement("img");
    avatar.src = "Umaru.jpg";
    avatar.alt = "AI Assistant";
    avatar.className = "chat-msg-avatar";
    
    // Create message bubble with text
    const m = document.createElement("div");
    m.className = "chat-msg ai";
    m.textContent = text;
    
    msgRow.appendChild(avatar);
    msgRow.appendChild(m);
    
    // Add map button if needed (for place selection during chat flow step 4)
    if (showMapButton && chatState.step === 4) {
      const mapBtn = document.createElement("button");
      mapBtn.className = "primary";
      mapBtn.style.marginTop = "8px";
      mapBtn.style.padding = "8px 16px";
      mapBtn.style.fontSize = "14px";
      mapBtn.textContent = "Select Location";
      
      // Open map picker modal when clicked
      mapBtn.addEventListener("click", () => {
        console.log('Opening map from chat...');
        mapModal.setAttribute("aria-hidden", "false");
        if (!map) {
          initMap();
        } else {
          map.setView([11.7945, 124.6487], 13);
        }
        mapSearchInput.focus();
      });
      msgRow.appendChild(mapBtn);
    }
    
    // Append message to chat log and scroll to bottom
    if (chatLog) chatLog.appendChild(msgRow);
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
  }
  
  /**
   * Display user message in chat
   * @param {string} text - User's message text
   */
  function pushUser(text) {
    const m = document.createElement("div");
    m.className = "chat-msg user";
    m.textContent = text;
    if (chatLog) chatLog.appendChild(m);
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
  }

  /**
   * Toggle chat modal open/closed
   * Opens and resets chat state, or closes if already open
   * Always resets conversation on open for fresh start
   */
  function toggleChat() {
    const isHidden = chatModal.getAttribute("aria-hidden") === "true";
    
    if (isHidden) {
      // OPEN: Initialize fresh chat conversation
      chatModal.setAttribute("aria-hidden", "false");
      chatLog.innerHTML = ""; // Clear previous messages
      chatState = { step: 0, draft: {} }; // Reset to idle state
      pushAI("Hello! 👋 I'm Umaru, I can help you search for events or create new ones. Say 'create' to add an event or 'search' to tell me what event you're looking for!");
    } else {
      // CLOSE: Hide chat
      chatModal.setAttribute("aria-hidden", "true");
    }
  }

  // Attach chat button click handler
  if (chatBtn) {
    // Use .onclick to ensure only one function is attached
    chatBtn.onclick = toggleChat; 
  }

  // ============================================
  // API INTEGRATION - OpenRouter AI
  // ============================================
  
  /**
   * Call OpenRouter API via secure proxy
   * Supports both local development and deployed environments
   * Local: http://localhost:3000/api/openrouter (run: node server/server.js)
   * Deployed: /api/openrouter (on Vercel or other hosting)
   * @param {string} prompt - User's input prompt for AI
   * @returns {Promise<string>} AI response text
   * @throws {Error} If API call fails
   */
  async function callOpenRouter(prompt) {
    // Determine if running locally or deployed
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const endpoint = isLocal
      ? "http://localhost:3000/api/openrouter"
      : "/api/openrouter";

    try {
      // Make POST request to API endpoint
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      
      // Check for HTTP errors
      if (!res.ok) {
        const err = await res.json();
        console.error("API Error:", res.status, err);
        throw new Error(err.error || `API Error: ${res.status}`);
      }
      
      // Extract response from OpenRouter API format
      const data = await res.json();
      let out = "";
      if (data.choices && data.choices[0] && data.choices[0].message)
        out = data.choices[0].message.content;
      else out = JSON.stringify(data);
      return out;
    } catch (err) {
      console.error("callOpenRouter error:", err);
      throw err;
    }
  }

  /**
   * Search existing events and history by title, date, time, or place
   * Case-insensitive partial matching on any field
   * @param {string} title - Search query (searches title, date, time, place fields)
   * @returns {Object} Object with matches and histMatches arrays
   */
  function searchSchedulesByTitle(title) {
    const q = title.trim().toLowerCase();
    
    // Search upcoming events
    const matches = events.filter((e) => 
      e.title.toLowerCase().includes(q) || 
      (e.date && e.date.toLowerCase().includes(q)) ||
      (e.time && e.time.toLowerCase().includes(q)) ||
      (e.place && e.place.toLowerCase().includes(q))
    );
    
    // Search completed/cancelled history
    const histMatches = history.filter((h) =>
      h.title.toLowerCase().includes(q) ||
      (h.date && h.date.toLowerCase().includes(q)) ||
      (h.time && h.time.toLowerCase().includes(q)) ||
      (h.place && h.place.toLowerCase().includes(q))
    );
    
    return { matches, histMatches };
  }

  /**
   * Handle user input in chat with multi-step event creation flow
   * State machine with different paths:
   * - Greetings: Simple responses
   * - 'create': Initiate 5-step event creation (title → date → time → place → confirm)
   * - 'search': Search for events by title or keyword
   * - General text: Send to OpenRouter for AI response
   * @param {string} raw - User's raw input text
   */
  async function handleUserInput(raw) {
    const t = raw.trim();
    const tl = t.toLowerCase();
    pushUser(t);
    if (chatInput) chatInput.value = "";

    // ========== GREETING RESPONSES ==========
    if (tl === 'hi' || tl === 'hello' || tl === 'hey' || tl === 'hey there') {
      pushAI("Hello! 👋 I'm Umaru, I can help you search for events or create new ones. Say 'create' to add an event or tell me what event you're looking for!");
      return;
    }

    // Thank you acknowledgment
    if (tl.includes('thank') || tl.includes('thanks')) {
      pushAI("You're welcome! Feel free to ask if you need help searching or creating events.");
      return;
    }

    // SPACE application explanation
    if (tl === 'space' || tl.includes('what is space') || tl.includes('what\'s space') || tl.includes('tell me about space')) {
      pushAI("SPACE is a smart scheduling platform powered by Umaru, your personal AI assistant. You can manually add events with a title, date, time, and location, or chat with Umaru to automatically create and organize your schedule. Umaru can also search existing events or places through chat, making it easy to plan efficiently. Whether you like to plan yourself or let AI assist, SPACE keeps your calendar organized, flexible, and stress-free.");
      return;
    }
    
    // Tagline information
    if (tl === 'tagline' || tl.includes('tagline of space') || tl.includes('tagline space') || tl.includes('What is the tagline of space')) {
      pushAI("Plan manually or chat with Umaru — your schedule, your way.");
      return;
    }

    // ========== CREATE EVENT FLOW ==========
    // Initiate new event creation (step 1 out of 5)
    if (tl.includes('create') || tl.includes('add') || tl.includes('new event')) {
      chatState.step = 1;
      pushAI("Great! Let's create a new event. What's the title of the event?");
      return;
    }

    // ========== SEARCH FLOW ==========
    // Initiate search for existing events
    if (tl.includes('search') || tl === 'search') {
      chatState.step = 200;
      pushAI("What events would you like to search for?");
      return;
    }

    // Search flow - step 200: Process search query and display results
    if (chatState.step === 200) {
      const searchTerm = t;
      const results = searchSchedulesByTitle(searchTerm);

      if (results.matches.length === 0 && results.histMatches.length === 0) {
        // No results found
        pushAI(`No events found yet. 📭 Create your first event! Say 'create', then I'll ask for the title, date (YYYY-MM-DD), and time (HH:MM AM/PM).`);
      } else {
        // Show upcoming events with details
        if (results.matches.length > 0) {
          const eventDetails = results.matches.map(ev => {
            const placeText = ev.place ? ` 📍 ${ev.place}` : '';
            return `${ev.title} - ${ev.date} at ${formatTime(ev.time)}${placeText}`;
          }).join("\n");
          pushAI(`✅ Found events:\n${eventDetails}`);
        }
        
        // Show history (completed/cancelled) events
        if (results.histMatches.length > 0) {
          const historyDetails = results.histMatches.map(h => {
            const status = h.status === 'confirmed' ? '✅' : '❌';
            const placeText = h.place ? ` 📍 ${h.place}` : '';
            return `${status} ${h.title} - ${h.date} at ${formatTime(h.time)}${placeText}`;
          }).join("\n");
          pushAI(`📋 In history:\n${historyDetails}`);
        }
      }
      chatState = { step: 0, draft: {} }; // Reset to idle
      return;
    }

    // ========== CREATE EVENT FLOW - STEP 1: Get Title ==========
    if (chatState.step === 1) {
      chatState.draft.title = t;
      chatState.step = 2;
      pushAI("Got it! What date? (format: YYYY-MM-DD, e.g., 2025-02-14)");
      return;
    }

    // ========== CREATE EVENT FLOW - STEP 2: Get Date ==========
    if (chatState.step === 2) {
      chatState.draft.date = t;
      chatState.step = 3;
      pushAI("Perfect! What time? (format: HH:MM AM/PM, e.g., 02:30 PM)");
      return;
    }

    // Create flow - step 3: get time and confirm
    if (chatState.step === 3) {
      // Convert 12-hour format to 24-hour format for storage
      const time12Input = t.trim().toUpperCase();
      let time24;
      
      try {
        const match = time12Input.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
        if (match) {
          let hours = parseInt(match[1]);
          const minutes = match[2];
          const ampm = match[3];
          
          if (ampm === 'PM' && hours !== 12) {
            hours += 12;
          } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
          }
          
          time24 = (hours < 10 ? '0' : '') + hours + ':' + minutes;
        } else {
          pushAI("Sorry, I didn't understand the time. Please use format like '02:30 PM' or '09:15 AM'");
          return;
        }
      } catch (e) {
        pushAI("Sorry, I didn't understand the time. Please use format like '02:30 PM' or '09:15 AM'");
        return;
      }
      
      chatState.draft.time = time24;
      chatState.step = 4;
      pushAI(`Great! Where will this event take place? (e.g., Office, Home, Cafe, or skip if not needed)`, true);
      return;
    }

    // Create flow - step 4: get place
    if (chatState.step === 4) {
      // Allow user to skip place or provide it
      if (tl === 'skip' || tl === 'none' || tl === 'no place') {
        chatState.draft.place = '';
        chatState.draft.lat = null;
        chatState.draft.lng = null;
      } else {
        chatState.draft.place = t;
        // If user typed a place but didn't use map, try to find coordinates
        chatState.draft.lat = null;
        chatState.draft.lng = null;
      }
      chatState.step = 5;
      pushAI(`✅ Confirm: "${chatState.draft.title}" on ${chatState.draft.date} at ${chatState.draft.time}${chatState.draft.place ? ` at ${chatState.draft.place}` : ''}? (say 'yes' or 'no')`);
      return;
    }

    // Create flow - step 5: confirm
    if (chatState.step === 5) {
      if (tl.startsWith('y') || tl === 'yes' || tl === 'yeah') {
        const ev = {
          id: Date.now(),
          title: chatState.draft.title,
          date: chatState.draft.date,
          time: chatState.draft.time,
          place: chatState.draft.place || '',
          lat: chatState.draft.lat || null,
          lng: chatState.draft.lng || null,
        };
        console.log("Creating event from chat:", ev);
        events.push(ev);
        saveEvents();
        console.log("Events after save:", events);
        scheduleAllNotifications();
        const placeText = ev.place ? ` at ${ev.place}` : '';
        pushAI(`✅ Event "${ev.title}" created successfully! It's scheduled for ${ev.date} at ${formatTime(ev.time)}${placeText}. Check the calendar! 📅`);
        chatState = { step: 0, draft: {} };
      } else {
        pushAI("Cancelled. What else can I help you with?");
        chatState = { step: 0, draft: {} };
      }
      return;
    }

    // Check if it looks like a search by looking for common event keywords or dates
    const isEventSearch = /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}|meeting|appointment|task|reminder|call|event|schedule|SPACE/.test(tl);

    if (isEventSearch) {
      // User is searching for events by keywords
      const searchTerm = t;
      const results = searchSchedulesByTitle(searchTerm);

      if (results.matches.length === 0 && results.histMatches.length === 0) {
        pushAI(`No events found yet. 📭 Create your first event! Say 'create', then I'll ask for the title, date (YYYY-MM-DD), and time (HH:MM AM/PM).`);
      } else {
        // Show upcoming events with date, time, and place
        if (results.matches.length > 0) {
          const eventDetails = results.matches.map(ev => {
            const placeText = ev.place ? ` 📍 ${ev.place}` : '';
            return `${ev.title} - ${ev.date} at ${formatTime(ev.time)}${placeText}`;
          }).join("\n");
          pushAI(`✅ Found events:\n${eventDetails}`);
        }
        
        // Show history with date, time, and place
        if (results.histMatches.length > 0) {
          const historyDetails = results.histMatches.map(h => {
            const status = h.status === 'confirmed' ? '✅' : '❌';
            const placeText = h.place ? ` 📍 ${h.place}` : '';
            return `${status} ${h.title} - ${h.date} at ${formatTime(h.time)}${placeText}`;
          }).join("\n");
          pushAI(`📋 In history:\n${historyDetails}`);
        }
      }
    } else {
      // User typed something unrelated to scheduling - call AI
      (async () => {
        try {
          const response = await callOpenRouter(t);
          pushAI(response);
        } catch (err) {
          console.error("AI response failed:", err);
          pushAI("I couldn't process that right now. Try asking about your events or say 'create' to add a new one!");
        }
      })();
    }
  }

  if (sendChat)
    sendChat.addEventListener("click", () => {
      if (chatInput && chatInput.value) handleUserInput(chatInput.value);
    });
  if (chatInput)
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") if (sendChat) sendChat.click();
    });
  if (closeChat) closeChat.addEventListener("click", () => {
    chatModal.setAttribute("aria-hidden", "true");
  });

  // History Modal Handlers
  const historyModal = document.getElementById("historyModal");
  const historyBtn = document.getElementById("historyBtn");
  const closeHistory = document.getElementById("closeHistory");

  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      renderHistory();
      historyModal.setAttribute("aria-hidden", "false");
      // Initialize maps after modal is shown
      setTimeout(() => {
        initializeHistoryMaps();
      }, 200);
    });
  }

  if (closeHistory) {
    closeHistory.addEventListener("click", () => {
      historyModal.setAttribute("aria-hidden", "true");
    });
  }

  // History Tab Navigation
  document.querySelectorAll(".history-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".history-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".history-tab-content")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab + "Tab").classList.add("active");
      
      // Initialize maps for the newly active tab after a short delay
      setTimeout(() => {
        initializeHistoryMaps();
      }, 100);
    });
  });

  // Dark Mode Toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  const isDarkMode = localStorage.getItem("darkMode") === "true";
  if (isDarkMode) document.documentElement.classList.add("dark-mode");

  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark-mode");
      const dm = document.documentElement.classList.contains("dark-mode");
      localStorage.setItem("darkMode", dm);
      darkModeToggle.textContent = dm ? "☀️" : "🌙";
    });
    darkModeToggle.textContent = isDarkMode ? "☀️" : "🌙";
  }

  // Map Modal Handlers
  if (placeInput) {
    placeInput.addEventListener("click", () => {
      console.log('Opening map picker...');
      mapModal.setAttribute("aria-hidden", "false");
      // Initialize map when modal opens
      if (!map) {
        console.log('Initializing map...');
        initMap();
      } else {
        // Reset map view
        map.setView([11.7945, 124.6487], 13);
      }
      mapSearchInput.focus();
    });
  }

  if (closeMap) {
    closeMap.addEventListener("click", () => {
      mapModal.setAttribute("aria-hidden", "true");
    });
  }

  if (mapSelectBtn) {
    mapSelectBtn.addEventListener("click", () => {
      if (selectedPlace) {
        // Check if we're in chat mode (step 4 - selecting place for event)
        if (chatState.step === 4) {
          // Save to chat draft
          chatState.draft.place = selectedPlace.address || selectedPlace.name;
          chatState.draft.lat = selectedPlace.lat;
          chatState.draft.lng = selectedPlace.lng;
          console.log('Location saved to chat:', chatState.draft);
          // Auto-reply with the place and ask for confirmation
          pushUser(selectedPlace.address || selectedPlace.name);
          chatState.step = 5;
          pushAI(`✅ Confirm: "${chatState.draft.title}" on ${chatState.draft.date} at ${chatState.draft.time} at ${chatState.draft.place}? (say 'yes' or 'no')`);
        } else {
          // Form mode
          placeInput.value = selectedPlace.address || selectedPlace.name;
          currentEventLocation.lat = selectedPlace.lat;
          currentEventLocation.lng = selectedPlace.lng;
          console.log('Location saved:', currentEventLocation);
          showFormMapPreview(selectedPlace.lat, selectedPlace.lng, selectedPlace.address || selectedPlace.name);
        }
      }
      else if (marker) {
        const pos = marker.getLatLng();
        if (chatState.step === 4) {
          // Save to chat draft
          chatState.draft.place = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
          chatState.draft.lat = pos.lat;
          chatState.draft.lng = pos.lng;
          console.log('Location saved from marker (chat):', chatState.draft);
          pushUser(`${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);
          chatState.step = 5;
          pushAI(`✅ Confirm: "${chatState.draft.title}" on ${chatState.draft.date} at ${chatState.draft.time} at ${chatState.draft.place}? (say 'yes' or 'no')`);
        } else {
          // Form mode
          placeInput.value = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
          currentEventLocation.lat = pos.lat;
          currentEventLocation.lng = pos.lng;
          console.log('Location saved from marker:', currentEventLocation);
          showFormMapPreview(pos.lat, pos.lng, `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);
        }
      }
      mapModal.setAttribute("aria-hidden", "true");
    });
  }

  // Show map preview in the form
  function showFormMapPreview(lat, lng, placeName) {
    formMapPreview.style.display = 'block';

    // Clear previous map
    if (formMapPreview._map) {
      formMapPreview._map.off();
      formMapPreview._map.remove();
      formMapPreview._map = null;
    }

    // Create preview map
    setTimeout(() => {
      try {
        const previewMap = L.map(formMapPreview).setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(previewMap);

        L.marker([lat, lng]).addTo(previewMap).bindPopup(placeName).openPopup();
        formMapPreview._map = previewMap;
        console.log('Form map preview initialized at:', lat, lng);
      } catch (error) {
        console.error('Form map preview error:', error);
        formMapPreview.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px;">⚠️ Map loading failed</div>';
      }
    }, 100);
  }

  // initial render and schedule existing reminders & notifications
  renderCalendar();
  scheduleAllReminders();
  scheduleAllNotifications();
  renderHistory();
})();
