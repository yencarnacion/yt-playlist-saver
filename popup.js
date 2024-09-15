document.getElementById("saveBtn").addEventListener("click", () => {
  console.log("Save button clicked");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log("Injecting script into tab:", tabs[0].id);
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: scrapePlaylistAndDownload,
      },
      (injectionResults) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          alert("Failed to execute script: " + chrome.runtime.lastError.message);
        } else {
          console.log("Script injected successfully");
        }
      }
    );
  });
});

function scrapePlaylistAndDownload() {
  console.log("scrapePlaylistAndDownload function called");
  let videos = [];
  const videoElements = document.querySelectorAll("ytd-playlist-video-renderer");

  videoElements.forEach((videoElement, index) => {
    // Title
    const titleElement = videoElement.querySelector("h3 #video-title");
    const title = titleElement ? titleElement.textContent.trim() : `Video ${index + 1}`;

    // Author/Channel
    const authorElement = videoElement.querySelector("ytd-channel-name #text");
    const author = authorElement ? authorElement.textContent.trim() : "N/A";

    // Video URL
    const urlElement = videoElement.querySelector("h3 a#video-title");
    let videoUrl = "N/A";
    if (urlElement) {
      const href = urlElement.getAttribute("href");
      // Construct full URL
      videoUrl = href.startsWith("http") ? href : `https://www.youtube.com${href}`;
    }

    // Video Length
    let length = "N/A";
    // Try to get length from the thumbnail overlay
    const lengthElement = videoElement.querySelector("#overlays ytd-thumbnail-overlay-time-status-renderer span");
    if (lengthElement) {
      length = lengthElement.textContent.trim();
    } else {
      // Fallback: Try to extract from h3's aria-label
      const h3Element = videoElement.querySelector("h3");
      const h3AriaLabel = h3Element ? h3Element.getAttribute("aria-label") : "";
      if (h3AriaLabel) {
        const lengthMatch = h3AriaLabel.match(/(\d+:\d+(:\d+)?|\d+\s\w+,?\s\d+\s\w+)/);
        if (lengthMatch && lengthMatch[0]) {
          length = lengthMatch[0];
        }
      }
    }

    // Published Date
    let publishedDate = "N/A";
    // Try to get from h3's aria-label
    const h3Element = videoElement.querySelector("h3");
    const h3AriaLabel = h3Element ? h3Element.getAttribute("aria-label") : "";
    if (h3AriaLabel) {
      const dateMatch = h3AriaLabel.match(/(Streamed \d+ years? ago|Streamed \d+ months? ago|Streamed \d+ days? ago|Premiered .+ ago|\d+ [a-zA-Z]+ ago)/);
      if (dateMatch && dateMatch[0]) {
        publishedDate = dateMatch[0];
      }
    } else {
      // Fallback: Try to get from metadata spans
      const metadataSpans = videoElement.querySelectorAll("#metadata-line span");
      if (metadataSpans.length >= 2) {
        // The last span often contains the published date
        publishedDate = metadataSpans[metadataSpans.length - 1].textContent.trim();
      } else if (metadataSpans.length === 1) {
        // If there's only one span, it might be the published date
        publishedDate = metadataSpans[0].textContent.trim();
      }
    }

    // Log any missing elements for debugging
    if (publishedDate === "N/A") {
      console.warn(`Published date not found for video: ${title}`);
    }
    if (length === "N/A") {
      console.warn(`Length not found for video: ${title}`);
    }

    // Add to array
    videos.push({
      title,
      author,
      publishedDate,
      length,
      videoUrl,
    });
  });

  console.log("Collected videos:", videos);

  if (videos.length === 0) {
    alert("No videos found. Please ensure you've scrolled through the entire playlist.");
    return;
  }

  // Create a blob and trigger download
  const dataStr = JSON.stringify(videos, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Create a link to trigger the download
  const a = document.createElement("a");
  a.href = url;
  a.download = "playlist.json";
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
