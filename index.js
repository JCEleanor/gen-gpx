/**
 * JSON to GPX Converter with Yamap API Integration
 * Handles both Yamap API fetching and file upload functionality
 */

// Global state
let trackData = null;
let currentDataSource = null; // 'yamap' or 'file'

// DOM element references
let yamapIdInput,
  fetchBtn,
  fileInput,
  uploadArea,
  convertBtn,
  statusDiv,
  previewDiv;
let tabBtns, tabContents;

// API Configuration
const YAMAP_API_BASE = "https://api.yamap.com/v3/activities";

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener("DOMContentLoaded", function () {
  initializeElements();
  setupEventListeners();
});

/**
 * Get references to DOM elements
 */
function initializeElements() {
  // Yamap elements
  yamapIdInput = document.getElementById("yamapId");
  fetchBtn = document.getElementById("fetchBtn");

  // File upload elements
  fileInput = document.getElementById("fileInput");
  uploadArea = document.querySelector(".upload-area");

  // Common elements
  convertBtn = document.getElementById("convertBtn");
  statusDiv = document.getElementById("status");
  previewDiv = document.getElementById("preview");

  // Tab elements
  tabBtns = document.querySelectorAll(".tab-btn");
  tabContents = document.querySelectorAll(".tab-content");
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Yamap functionality
  fetchBtn.addEventListener("click", fetchYamapData);
  yamapIdInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") fetchYamapData();
  });
  yamapIdInput.addEventListener("input", validateYamapId);

  // File upload functionality
  uploadArea.addEventListener("dragover", handleDragOver);
  uploadArea.addEventListener("dragleave", handleDragLeave);
  uploadArea.addEventListener("drop", handleDrop);
  fileInput.addEventListener("change", handleFileInputChange);

  // Convert button
  convertBtn.addEventListener("click", convertToGPX);
}

/**
 * Switch between tabs
 * @param {string} tabName - Name of the tab to switch to
 */
function switchTab(tabName) {
  // Update tab buttons
  tabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  // Update tab contents
  tabContents.forEach((content) => {
    content.classList.toggle("active", content.id === `${tabName}-tab`);
  });

  // Clear previous data when switching tabs
  clearData();
}

/**
 * Validate Yamap ID input (numbers only)
 */
function validateYamapId() {
  const value = yamapIdInput.value;
  const numbersOnly = value.replace(/[^0-9]/g, "");

  if (value !== numbersOnly) {
    yamapIdInput.value = numbersOnly;
  }

  fetchBtn.disabled = numbersOnly.length === 0;
}

/**
 * Fetch track data from Yamap API
 */
async function fetchYamapData() {
  const activityId = yamapIdInput.value.trim();

  if (!activityId) {
    showStatus("Please enter a Yamap Activity ID", "error");
    return;
  }

  if (!/^\d+$/.test(activityId)) {
    showStatus("Activity ID must contain only numbers", "error");
    return;
  }

  fetchBtn.disabled = true;
  fetchBtn.textContent = "Fetching...";
  showStatus("Fetching track data from Yamap API...", "info");

  try {
    const apiUrl = `${YAMAP_API_BASE}/${activityId}/activity_regularized_track`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Activity ${activityId} not found. Please check the ID and try again.`
        );
      } else if (response.status === 403) {
        throw new Error(
          "Access denied. The activity might be private or require authentication."
        );
      } else if (response.status >= 500) {
        throw new Error("Yamap server error. Please try again later.");
      } else {
        throw new Error(
          `Failed to fetch data: ${response.status} ${response.statusText}`
        );
      }
    }

    const data = await response.json();
    console.log(data?.activity_regularized_track?.points);

    if (
      !data?.activity_regularized_track?.points ||
      !Array.isArray(data?.activity_regularized_track?.points) ||
      data?.activity_regularized_track?.points.length === 0
    ) {
      throw new Error("No track data found for this activity");
    }

    // Validate and process Yamap data
    validateYamapData(data?.activity_regularized_track?.points);

    trackData = data?.activity_regularized_track?.points;
    currentDataSource = "yamap";

    showStatus(
      `Successfully loaded ${data?.activity_regularized_track?.points.length} trackpoints from Yamap`,
      "success"
    );
    convertBtn.disabled = false;
    showPreview(data?.activity_regularized_track?.points, "yamap");
  } catch (error) {
    console.error("Yamap API Error:", error);
    showStatus(`Error: ${error.message}`, "error");
    trackData = null;
    convertBtn.disabled = true;
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = "Fetch Track Data";
  }
}

/**
 * Validate Yamap API response data
 * @param {Array} data - The API response data
 * @throws {Error} If validation fails
 */
function validateYamapData(data) {
  if (!Array.isArray(data)) {
    throw new Error("Invalid data format: expected array");
  }

  const firstPoint = data[0];
  if (!firstPoint) {
    throw new Error("No trackpoints found");
  }

  // Check for required fields (adjust based on actual Yamap API response)
  if (!firstPoint.coord && !firstPoint.coordinates) {
    throw new Error("Trackpoints missing coordinate data");
  }

  if (!firstPoint.pass_at && !firstPoint.timestamp && !firstPoint.time) {
    throw new Error("Trackpoints missing timestamp data");
  }
}

/**
 * Handle drag over event for file upload
 * @param {DragEvent} e - The drag event
 */
function handleDragOver(e) {
  e.preventDefault();
  uploadArea.classList.add("dragover");
}

/**
 * Handle drag leave event for file upload
 */
function handleDragLeave() {
  uploadArea.classList.remove("dragover");
}

/**
 * Handle drop event for file upload
 * @param {DragEvent} e - The drop event
 */
function handleDrop(e) {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

/**
 * Handle file input change event
 * @param {Event} e - The change event
 */
function handleFileInputChange(e) {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
}

/**
 * Process the uploaded JSON file
 * @param {File} file - The uploaded file
 */
async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".json")) {
    showStatus("Please select a JSON file.", "error");
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    validateJsonData(data);

    trackData = data;
    currentDataSource = "file";

    showStatus(
      `Successfully loaded ${data.length} trackpoints from file`,
      "success"
    );
    convertBtn.disabled = false;
    showPreview(data, "file");
  } catch (error) {
    showStatus(`Error reading file: ${error.message}`, "error");
    trackData = null;
    convertBtn.disabled = true;
  }
}

/**
 * Validate the structure of JSON file data
 * @param {Array} data - The JSON data to validate
 * @throws {Error} If validation fails
 */
function validateJsonData(data) {
  if (!Array.isArray(data)) {
    throw new Error("JSON file must contain an array of objects");
  }

  if (data.length === 0) {
    throw new Error("JSON array is empty");
  }

  const firstPoint = data[0];
  if (!firstPoint.coord || !firstPoint.pass_at) {
    throw new Error('JSON objects must have "coord" and "pass_at" properties');
  }

  if (!Array.isArray(firstPoint.coord) || firstPoint.coord.length < 2) {
    throw new Error(
      "Coordinate must be an array with at least 2 elements [longitude, latitude]"
    );
  }
}

/**
 * Clear all data and reset UI
 */
function clearData() {
  trackData = null;
  currentDataSource = null;
  convertBtn.disabled = true;
  statusDiv.innerHTML = "";
  previewDiv.innerHTML = "";

  // Reset inputs
  yamapIdInput.value = "";
  fileInput.value = "";
  fetchBtn.disabled = true;
}

/**
 * Display status message to user
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', or 'info')
 */
function showStatus(message, type) {
  const statusClass = type === "info" ? "success" : type;
  statusDiv.innerHTML = `<div class="status ${statusClass}">${message}</div>`;
}

/**
 * Show preview of loaded data
 * @param {Array} data - The track data
 * @param {string} source - The data source ('yamap' or 'file')
 */
function showPreview(data, source) {
  const samplePoints = data.slice(0, 3);
  const sourceText = source === "yamap" ? "Yamap API" : "uploaded file";
  const previewText =
    `Sample trackpoints from ${sourceText} (showing first 3 of ${data.length}):\n\n` +
    JSON.stringify(samplePoints, null, 2);

  previewDiv.innerHTML = `
        <div class="preview">
            <h3>Data Preview</h3>
            <div class="preview-content">${previewText}</div>
        </div>
    `;
}

/**
 * Convert track data to GPX and trigger download
 */
function convertToGPX() {
  if (!trackData) {
    showStatus(
      "No data loaded. Please fetch from Yamap or upload a JSON file first.",
      "error"
    );
    return;
  }

  const trackName = document.getElementById("trackName").value || "GPS Track";
  const trackDesc = document.getElementById("trackDesc").value || "";

  try {
    const gpxContent = generateGPX(trackData, trackName, trackDesc);
    downloadGPX(gpxContent, trackName);

    const sourceText =
      currentDataSource === "yamap" ? "Yamap data" : "file data";
    showStatus(
      `GPX file generated successfully from ${sourceText}!`,
      "success"
    );
  } catch (error) {
    showStatus(`Error generating GPX: ${error.message}`, "error");
  }
}

/**
 * Generate GPX XML content from track data
 * @param {Array} data - Array of trackpoint objects
 * @param {string} name - Track name
 * @param {string} description - Track description
 * @returns {string} GPX XML content
 */
function generateGPX(data, name, description) {
  const header = generateGPXHeader(name, description);
  const trackpoints = generateTrackpoints(data);
  const footer = generateGPXFooter();

  return header + "\n" + trackpoints + footer;
}

/**
 * Generate GPX header with metadata
 * @param {string} name - Track name
 * @param {string} description - Track description
 * @returns {string} GPX header XML
 */
function generateGPXHeader(name, description) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="JSON to GPX Converter with Yamap API"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <n>${escapeXml(name)}</n>
    <desc>${escapeXml(description)}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <n>${escapeXml(name)}</n>
    <desc>${escapeXml(description)}</desc>
    <trkseg>`;
}

/**
 * Generate trackpoint XML from data array
 * @param {Array} data - Array of trackpoint objects
 * @returns {string} Trackpoints XML
 */
function generateTrackpoints(data) {
  return data
    .map((point) => {
      // Handle different coordinate formats (Yamap API vs file format)
      let lon, lat;
      if (point.coord) {
        [lon, lat] = point.coord;
      } else if (point.coordinates) {
        [lon, lat] = point.coordinates;
      } else if (
        point.longitude !== undefined &&
        point.latitude !== undefined
      ) {
        lon = point.longitude;
        lat = point.latitude;
      } else {
        throw new Error("Invalid coordinate format in trackpoint");
      }

      // Handle different timestamp formats
      let timestamp;
      if (point.pass_at) {
        timestamp = new Date(point.pass_at * 1000).toISOString();
      } else if (point.timestamp) {
        timestamp = new Date(point.timestamp * 1000).toISOString();
      } else if (point.time) {
        timestamp = new Date(point.time).toISOString();
      } else {
        timestamp = new Date().toISOString(); // Fallback to current time
      }

      const elevation = point.altitude || point.elevation || 0;

      let trkpt = `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">
        <ele>${elevation.toFixed(2)}</ele>
        <time>${timestamp}</time>`;

      // Add extensions for additional data if available
      if (
        point.horizontal_speed !== null ||
        point.vertical_speed !== null ||
        point.speed !== null
      ) {
        trkpt += generateExtensions(point);
      }

      trkpt += `
      </trkpt>`;
      return trkpt;
    })
    .join("\n");
}

/**
 * Generate GPX extensions for additional data
 * @param {Object} point - Trackpoint object
 * @returns {string} Extensions XML
 */
function generateExtensions(point) {
  let extensions = `
        <extensions>`;

  if (point.horizontal_speed !== null && point.horizontal_speed !== undefined) {
    extensions += `
          <speed>${point.horizontal_speed}</speed>`;
  } else if (point.speed !== null && point.speed !== undefined) {
    extensions += `
          <speed>${point.speed}</speed>`;
  }

  if (point.vertical_speed !== null && point.vertical_speed !== undefined) {
    extensions += `
          <vspeed>${point.vertical_speed}</vspeed>`;
  }

  extensions += `
        </extensions>`;

  return extensions;
}

/**
 * Generate GPX footer
 * @returns {string} GPX footer XML
 */
function generateGPXFooter() {
  return `
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Escape XML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
  if (!text) return "";
  return text.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Download GPX content as file
 * @param {string} content - GPX XML content
 * @param {string} filename - Base filename (without extension)
 */
function downloadGPX(content, filename) {
  const blob = new Blob([content], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${sanitizeFilename(filename)}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize filename by removing invalid characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9\-_\s]/gi, "_").trim();
}
