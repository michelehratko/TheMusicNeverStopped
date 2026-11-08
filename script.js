
let venues = [];
let activeView = "default";

function scatterCards() {
  const wall = document.querySelector(".poster-wall");
  const cards = document.querySelectorAll(".venue-card");

  if (!wall || wall.classList.contains("timeline-view") || cards.length === 0) {
    return;
  }

  if (wall.classList.contains("capacity-view")) {
    layoutCapacity(wall, [...cards]);
    return;
  }

  const cardWidth = cards[0].offsetWidth;
  const cardHeight = cards[0].offsetHeight;
  const margin = Math.min(20, wall.clientWidth * 0.04);
  const columnPitch = cardWidth + 12;
  const rowPitch = cardHeight + 10;
  const availableWidth = Math.max(cardWidth, wall.clientWidth - margin * 2);
  const columnCount = Math.max(1, Math.floor((availableWidth - cardWidth) / columnPitch) + 1);
  const rowCount = Math.ceil(cards.length / columnCount);
  const neededHeight = margin * 2 + cardHeight + (rowCount - 1) * rowPitch;

  wall.style.minHeight = `${Math.max(window.innerHeight * 1.5, neededHeight)}px`;
  const columnStep = columnCount > 1
    ? (availableWidth - cardWidth) / (columnCount - 1)
    : 0;
  cards.forEach((card, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;
    const maxX = Math.max(margin, wall.clientWidth - cardWidth - margin);
    const rowOffset = row % 2 === 0 ? 0 : columnStep / 2;
    const randomOffset = amount => {
      const value = Math.sin((index + 1) * 12.9898 + amount * 78.233) * 43758.5453;
      return (value - Math.floor(value) - 0.5) * 26;
    };
    const left = Math.max(
      margin,
      Math.min(maxX, margin + column * columnStep + rowOffset + randomOffset(1))
    );
    const top = margin + row * rowPitch + randomOffset(2);

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  });
}

async function loadVenues() {
  const container = document.getElementById("card-container");

  if (!container) {
    return;
  }

  try {
    const response = await fetch("venues.json");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    venues = await response.json();
    buildFilters();
    setView(activeView);
  } catch (error) {
    console.error("Unable to load venues", error);
    container.innerHTML = "<p class=\"empty-state\">Unable to load live music listings.</p>";
  }
}

function renderCards(data) {
  const container = document.getElementById("card-container");
  const popup = document.getElementById("venue-popup");
  const popupImage = document.getElementById("popup-image");
  const popupTitle = document.getElementById("popup-title");
  const popupDescription = document.getElementById("popup-description");
  const popupData = document.getElementById("popup-data");
  const popupClose = document.getElementById("popup-close");

  if (!container || !popup || !popupImage || !popupTitle || !popupDescription || !popupData || !popupClose) {
    return;
  }

  container.replaceChildren();
  let activeImageSource = null;
  popupImage.onload = () => {
    if (!activeImageSource || popupImage.getAttribute("src") !== activeImageSource) {
      return;
    }

    popupImage.hidden = false;
  };
  popupImage.onerror = () => {
    if (!activeImageSource || popupImage.getAttribute("src") !== activeImageSource) {
      return;
    }
    popupImage.hidden = true;
  };

  data.forEach(venue => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "venue-card";
    card.setAttribute("aria-label", `View ${venue.name || `venue ${venue.id}`}`);

    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    image.hidden = true;
    if (venue.image) {
      image.src = venue.image;
      image.hidden = false;
    }

    card.dataset.venueId = venue.id;
    card.append(image);
    card.addEventListener("click", () => {
      popupImage.alt = venue.name || `Venue ${venue.id}`;
      activeImageSource = venue.image || null;
      popupImage.hidden = true;
      popupImage.removeAttribute("src");
      if (activeImageSource) {
        popupImage.setAttribute("src", activeImageSource);
      }
      popupTitle.textContent = venue.name || `Venue ${venue.id}`;
      popupDescription.textContent = venue.description || "";
      popupData.replaceChildren();

      const fields = [
        ["Neighborhood", venue.neighborhood],
        ["Opened", venue.opened],
        ["Status", venue.status],
        ["Capacity", venue.capacity],
        ["Genres", Array.isArray(venue.genres) ? venue.genres.join(", ") : venue.genres],
        ["Independent", typeof venue.independent === "boolean" ? (venue.independent ? "Yes" : "No") : null]
      ];

      fields.forEach(([label, value]) => {
        if (value === undefined || value === null || value === "") {
          return;
        }

        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = String(value);
        popupData.append(term, detail);
      });

      popup.showModal();
    });
    container.appendChild(card);
  });

  if (data.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "No venues match these filters. Try clearing a selection.";
    container.append(message);
  }

  /* VIEW FILTERS */ 
  if (!document.querySelector(".poster-wall").classList.contains("timeline-view")) {
  scatterCards();
}

  popupClose.onclick = () => popup.close();
  popup.onclick = event => {
    if (event.target === popup) {
      popup.close();
    }
  };
}
loadVenues();
window.addEventListener("resize", scatterCards);

/* side bar open and close */ 
const nav = document.getElementById("side-nav");
const navContent = document.getElementById("side-nav-content");
const toggle = document.getElementById("nav-toggle");
const close = document.getElementById("nav-close");

function setNavOpen(open) {
  nav.classList.toggle("is-open", open);
  navContent.inert = !open;
  navContent.setAttribute("aria-hidden", String(!open));
  toggle.setAttribute("aria-expanded", String(open));
}

toggle.addEventListener("click", () => {
  setNavOpen(true);
});

close.addEventListener("click", () => setNavOpen(false));

// Treat capacity ranges such as "75,000+" as their stated lower bound.
function capacityNumber(value) {
  return Number.parseFloat(String(value ?? "").replaceAll(",", "")) || 0;
}

function layoutCapacity(wall, cards) {
  const margin = 24;
  const availableWidth = Math.max(1, wall.clientWidth - margin * 2);
  const capacityCeiling = 15000;
  const byId = new Map(venues.map(venue => [venue.id, venue]));
  // Stable random values keep the arrangement from jumping when resizing.
  const random = (id, seed) => {
    let hash = seed;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  };
  const sizedCards = cards.map(card => {
    const id = card.dataset.venueId;
    const capacity = capacityNumber(byId.get(id)?.capacity);
    // Width increases linearly; larger venues share the maximum card size.
    const scale = Math.max(0, Math.min(1, capacity / capacityCeiling));
    const width = Math.min(availableWidth, 48 + 352 * scale);
    return { card, id, width, height: width * 1.5 };
  });
  const totalArea = sizedCards.reduce((area, card) => area + card.width * card.height, 0);
  // Size the canvas for a loose collage with room for overlaps.
  const canvasHeight = Math.max(
    window.innerHeight * 1.5,
    totalArea / (availableWidth * 0.8) + margin * 2,
    ...sizedCards.map(card => card.height + margin * 2)
  );

  const placed = [];
  // Place large posters first so small posters can remain visible in front.
  sizedCards.sort((a, b) => b.width - a.width).forEach(({ card, id, width, height }, index) => {
    let best = null;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = margin + random(id, 12345 + attempt * 2) * Math.max(0, availableWidth - width);
      const y = margin + random(id, 67890 + attempt * 2) * Math.max(0, canvasHeight - margin * 2 - height);
      let overlap = 0;
      let nearestGap = Math.max(availableWidth, canvasHeight);
      placed.forEach(other => {
        const intersectionWidth = Math.max(0, Math.min(x + width, other.x + other.width) - Math.max(x, other.x));
        const intersectionHeight = Math.max(0, Math.min(y + height, other.y + other.height) - Math.max(y, other.y));
        const intersection = intersectionWidth * intersectionHeight;
        // A larger poster neither attracts nor blocks a smaller poster.
        if (width > other.width * 0.6) {
          overlap += intersection / Math.min(width * height, other.width * other.height);
          const distance = Math.hypot(
            x + width / 2 - other.x - other.width / 2,
            y + height / 2 - other.y - other.height / 2
          );
          nearestGap = Math.min(nearestGap, distance);
        }
      });
      // Spread comparable cards across the page, allowing partial overlap.
      const score = overlap * 0.2 - nearestGap / Math.max(availableWidth, canvasHeight);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y, width, height };
      }
    }
    placed.push(best);
    card.style.zIndex = String(index + 1);
    card.style.width = `${width}px`;
    card.style.left = `${best.x}px`;
    card.style.top = `${best.y}px`;
  });
  wall.style.minHeight = `${canvasHeight}px`;
}

function setView(view) {
  activeView = view;
  const wall = document.querySelector(".poster-wall");
  wall.classList.toggle("timeline-view", view === "timeline");
  wall.classList.toggle("capacity-view", view === "capacity");
  wall.style.minHeight = "100vh";
  ["default", "timeline", "capacity"].forEach(name => {
    const link = document.getElementById(`${name}-view`);
    if (name === view) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  const filtered = getFilteredVenues();
  document.getElementById("filter-count").textContent = `${filtered.length} of ${venues.length} venues`;
  renderCards(view === "timeline"
    ? [...filtered].sort((a, b) => a.opened - b.opened)
    : filtered);
}

["default", "timeline", "capacity"].forEach(view => {
  document.getElementById(`${view}-view`).addEventListener("click", () => setView(view));
});

function filterValues(venue, field) {
  const value = venue[field];
  if (Array.isArray(value)) return value;
  if (value === true) return ["true"];
  if (value === false) return ["false"];
  return [value || "unknown"];
}

function buildFilters() {
  document.querySelectorAll("[data-filter-options]").forEach(list => {
    const field = list.dataset.filterOptions;
    const options = [...new Set(venues.flatMap(venue => filterValues(venue, field)))].sort();
    list.replaceChildren();
    options.forEach(value => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = field;
      input.value = value;
      const text = value === "unknown" ? "Unknown"
        : field === "independent" ? (value === "true" ? "Independent" : "Corporate")
        : field === "historic" ? (value === "true" ? "Yes" : "No")
        : value;
      label.append(input, document.createTextNode(` ${text}`));
      item.append(label);
      list.append(item);
    });
  });
}

function getFilteredVenues() {
  const groups = new Map();
  document.querySelectorAll("#venue-filters input:checked").forEach(input => {
    if (!groups.has(input.name)) groups.set(input.name, new Set());
    groups.get(input.name).add(input.value);
  });
  // Any selected option within a group; all selected groups must match.
  return venues.filter(venue => [...groups].every(([field, selected]) =>
    filterValues(venue, field).some(value => selected.has(value))
  ));
}

document.getElementById("venue-filters").addEventListener("change", () => setView(activeView));
document.getElementById("clear-filters").addEventListener("click", () => {
  document.querySelectorAll("#venue-filters input").forEach(input => { input.checked = false; });
  setView(activeView);
});
