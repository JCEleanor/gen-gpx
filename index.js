let jsonData = null;

// File upload handling
const fileInput = document.getElementById("fileInput");
const uploadArea = document.querySelector(".upload-area");
const convertBtn = document.getElementById("convertBtn");
const statusDiv = document.getElementById("status");
const previewDiv = document.getElementById("preview");

// Drag and drop
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".json")) {
    showStatus("Please select a JSON file.", "error");
    return;
  }

  try {
    const text = await file.text();
    jsonData = JSON.parse(text);

    if (!Array.isArray(jsonData)) {
      throw new Error("JSON file must contain an array of objects");
    }

    // Validate data structure
    if (jsonData.length === 0) {
      throw new Error("JSON array is empty");
    }

    const firstPoint = jsonData[0];
    if (!firstPoint.coord || !firstPoint.pass_at) {
      throw new Error(
        'JSON objects must have "coord" and "pass_at" properties'
      );
    }

    showStatus(`Successfully loaded ${jsonData.length} trackpoints`, "success");
    convertBtn.disabled = false;

    // Show preview
    showPreview();
  } catch (error) {
    showStatus(`Error reading file: ${error.message}`, "error");
    jsonData = null;
    convertBtn.disabled = true;
  }
}

function showStatus(message, type) {
  statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function showPreview() {
  const samplePoints = jsonData.slice(0, 3);
  const previewText =
    `Sample trackpoints (showing first 3 of ${jsonData.length}):\n\n` +
    JSON.stringify(samplePoints, null, 2);

  previewDiv.innerHTML = `
                <div class="preview">
                    <h3>Data Preview</h3>
                    <div class="preview-content">${previewText}</div>
                </div>
            `;
}

convertBtn.addEventListener("click", convertToGPX);

function convertToGPX() {
  if (!jsonData) return;

  const trackName = document.getElementById("trackName").value || "GPS Track";
  const trackDesc = document.getElementById("trackDesc").value || "";

  try {
    const gpxContent = generateGPX(jsonData, trackName, trackDesc);
    downloadGPX(gpxContent, trackName);
    showStatus("GPX file generated and downloaded successfully!", "success");
  } catch (error) {
    showStatus(`Error generating GPX: ${error.message}`, "error");
  }
}

function generateGPX(data, name, description) {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="JSON to GPX Converter" 
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     xmlns="http://www.topografix.com/GPX/1/1" 
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <trkseg>`;

  const trackpoints = data
    .map((point) => {
      const [lon, lat] = point.coord;
      const timestamp = new Date(point.pass_at * 1000).toISOString();
      const elevation = point.altitude || 0;

      let trkpt = `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">
        <ele>${elevation.toFixed(2)}</ele>
        <time>${timestamp}</time>`;

      // Add extensions for additional data if available
      if (point.horizontal_speed !== null || point.vertical_speed !== null) {
        trkpt += `
        <extensions>`;
        if (point.horizontal_speed !== null) {
          trkpt += `
          <speed>${point.horizontal_speed}</speed>`;
        }
        if (point.vertical_speed !== null) {
          trkpt += `
          <vspeed>${point.vertical_speed}</vspeed>`;
        }
        trkpt += `
        </extensions>`;
      }

      trkpt += `
      </trkpt>`;
      return trkpt;
    })
    .join("\n");

  const footer = `
    </trkseg>
  </trk>
</gpx>`;

  return header + "\n" + trackpoints + footer;
}

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
    }
  });
}

function downloadGPX(content, filename) {
  const blob = new Blob([content], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9]/gi, "_")}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
