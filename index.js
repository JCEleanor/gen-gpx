/**
 * JSON to GPX Converter with Yamap API Integration
 * Handles both Yamap API fetching and file upload functionality
 */

// DOM elements
const yamapLinkInput = document.getElementById("yamapLink");
const convertBtn = document.getElementById("convertBtn");
const statusDiv = document.getElementById("status");
const previewDiv = document.getElementById("preview");

// Extract activity ID from YAMAP URL
function extractActivityId(url) {
  const match = url.match(/yamap\.com\/activities\/(\d+)/);
  return match ? match[1] : null;
}

// Validate YAMAP URL
function validateYamapUrl(url) {
  if (!url) return false;

  const activityId = extractActivityId(url);
  if (!activityId) {
    showStatus(
      "Invalid YAMAP URL. Please use format: https://yamap.com/activities/39755763",
      "error"
    );
    return false;
  }

  return activityId;
}

// Fetch activity data from YAMAP API
async function fetchActivityData(activityId) {
  const apiUrl = `https://api.yamap.com/v4/activities/${activityId}/activity_regularized_track`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch activity data: ${error.message}`);
  }
}

// Handle YAMAP link input
async function handleYamapLink() {
  const url = yamapLinkInput.value.trim();

  if (!url) {
    showStatus("Please enter a YAMAP activity link", "error");
    return;
  }

  const activityId = validateYamapUrl(url);
  if (!activityId) return;

  showStatus("Fetching activity data...", "success");
  convertBtn.disabled = true;

  try {
    const response = await fetchActivityData(activityId);

    // Extract points from the nested structure
    if (
      !response.activity_regularized_track ||
      !response.activity_regularized_track.points
    ) {
      throw new Error(
        "Invalid response format - missing activity_regularized_track.points"
      );
    }

    jsonData = response.activity_regularized_track.points;

    if (!Array.isArray(jsonData)) {
      throw new Error("Invalid response format - points should be an array");
    }

    if (jsonData.length === 0) {
      throw new Error("No trackpoints found in activity");
    }

    // Validate data structure
    const firstPoint = jsonData[0];
    if (!firstPoint.coord || !firstPoint.pass_at) {
      throw new Error('Trackpoints must have "coord" and "pass_at" properties');
    }

    showStatus(
      `Successfully loaded ${jsonData.length} trackpoints from activity ${activityId}`,
      "success"
    );
    convertBtn.disabled = false;
    showPreview(data, "file");
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    jsonData = null;
    convertBtn.disabled = true;
  }
}

// Handle input events
yamapLinkInput.addEventListener("input", () => {
  const url = yamapLinkInput.value.trim();
  if (url && validateYamapUrl(url)) {
    convertBtn.disabled = false;
  } else {
    convertBtn.disabled = true;
  }
});

yamapLinkInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    handleYamapLink();
  }
});

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

convertBtn.addEventListener("click", () => {
  if (jsonData) {
    convertToGPX();
  } else {
    handleYamapLink();
  }
});

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
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="YAMAP to GPX Converter" 
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
