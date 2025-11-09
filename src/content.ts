import { renderPopup, PopupData, Teacher } from "./popupRenderer";

const observedElements = new Set<HTMLElement>();

function getTopZIndex(): number {
  let max = 0;
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const z = parseInt(getComputedStyle(el).zIndex || "0", 10);
    if (!Number.isNaN(z)) max = Math.max(max, z);
  }
  return Math.max(max, 10050);
}

function elevatePopup(popup: HTMLElement) {
  popup.style.zIndex = String(getTopZIndex() + 10);
}

function createPopup() {
  const popup = document.createElement("div");
  popup.id = "rmp-popup";
  popup.className =
    "absolute bg-white text-black p-4 shadow-lg rounded-lg border border-gray-300 z-50";
  popup.style.display = "none";
  popup.style.position = "absolute";
  popup.style.pointerEvents = "auto";

  elevatePopup(popup);

  document.body.appendChild(popup);
  return popup;
}

async function showPopup(
  target: HTMLElement,
  data: PopupData,
  hoveredName: string,
  selectedCourse: string = "all",
  selectedUniversity: string = "tufts"
) {
  const popup =
    (document.getElementById("rmp-popup") as HTMLDivElement) || createPopup();

  popup.innerHTML = renderPopup(data, selectedCourse, selectedUniversity);

  const rect = target.getBoundingClientRect();
  const scaleFactor = 0.7;

  popup.style.transformOrigin = "top left";
  popup.style.transform = `scale(${scaleFactor})`;
  popup.style.top = `${rect.bottom + window.scrollY}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;

  elevatePopup(popup);
  popup.style.display = "block";

  attachPopupHoverLogic(target, popup);
  attachDropdownChange(popup, data, hoveredName, target);
  attachOtherMatchesClick(popup, hoveredName, target, data, selectedUniversity);
  attachToggleUniversityClick(popup, hoveredName, target, data);
}

function hidePopup() {
  const popup = document.getElementById("rmp-popup");
  if (popup) {
    popup.style.display = "none";
  }
}

async function parseAndFetchTeachers(
  fullName: string,
  schoolId: string
): Promise<Teacher[]> {
  const parted = fullName
    .split(/,|\/|&| and /i)
    .map((s) => s.trim())
    .filter(Boolean);

  const count = parted.length;
  if (count >= 6) {
    console.log("6+ professors, skipping query");
    return [];
  }

  let allTeachers: Teacher[] = [];

  let maxResultsPer = 5;

  if (count === 1) {
    maxResultsPer = 5;
  } else if (count === 2) {
    maxResultsPer = 2;
  } else if (count >= 3 && count <= 5) {
    maxResultsPer = 1;
  }

  for (const sub of parted) {
    const { firstName, lastName } = parseFirstLast(sub);
    const processedName = `${firstName} ${lastName}`.trim();
    if (!processedName) continue;

    const partial = await callBackgroundRMP(
      processedName,
      schoolId,
      maxResultsPer
    );
    if (partial && partial.length > 0) {
      for (const p of partial) {
        if (schoolId === "U2Nob29sLTEwNDA=") {
          (p as any).origin = "tufts";
        } else {
          (p as any).origin = "all";
        }
      }
      allTeachers = allTeachers.concat(partial);
    }
  }

  return allTeachers;
}

function parseFirstLast(subName: string): {
  firstName: string;
  lastName: string;
} {
  const clean = subName
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = clean.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    return { firstName: "", lastName: tokens[0] };
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  if (/^[A-Za-z]\.?$/.test(first)) {
    return { firstName: "", lastName: last };
  }

  if (/^(dr\.?|prof\.?)$/i.test(first)) {
    const nextFirst = tokens[1] || "";
    const maybeLast = tokens[tokens.length - 1] || "";
    if (/^[A-Za-z]\.?$/.test(nextFirst)) {
      return { firstName: "", lastName: maybeLast };
    }
    return { firstName: nextFirst, lastName: maybeLast };
  }

  return { firstName: first, lastName: last };
}

function attachPopupHoverLogic(professorDiv: HTMLElement, popup: HTMLElement) {
  professorDiv.addEventListener("mouseleave", (evt) => {
    if (popup.contains(evt.relatedTarget as Node)) return;
    hidePopup();
  });
  popup.addEventListener("mouseleave", (evt) => {
    if (professorDiv.contains(evt.relatedTarget as Node)) return;
    hidePopup();
  });
}

function attachDropdownChange(
  popup: HTMLElement,
  originalData: PopupData,
  hoveredName: string,
  professorDiv: HTMLElement
) {
  const dropdown = popup.querySelector("#course-dropdown") as HTMLSelectElement;
  if (!dropdown) return;

  dropdown.addEventListener("change", () => {
    const selectedCourse = dropdown.value;

    let filteredRatings = originalData.allRatings || [];
    if (selectedCourse !== "all") {
      filteredRatings = filteredRatings.filter(
        (r) => r.class === selectedCourse
      );
    }

    const updatedDistribution = computeRatingsDistribution(filteredRatings);
    const updatedStats = computeNewAverages(filteredRatings);

    const newData: PopupData = {
      ...originalData,
      ratings: filteredRatings,
      ratingsDistribution: updatedDistribution,
      avgRatingRounded: updatedStats.avgRatingRounded,
      avgDifficulty: updatedStats.avgDifficulty,
      numRatings: filteredRatings.length,
    };

    showPopup(professorDiv, newData, hoveredName, selectedCourse);
  });
}

function attachOtherMatchesClick(
  popup: HTMLElement,
  hoveredName: string,
  professorDiv: HTMLElement,
  currentData: PopupData,
  selectedUniversity: string
) {
  popup.querySelectorAll(".choose-other").forEach((btn) => {
    btn.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      const target = evt.currentTarget as HTMLElement;
      const profJson = target.getAttribute("data-oth");
      if (!profJson) return;
      try {
        const chosenProf: Teacher = JSON.parse(profJson);

        await chrome.storage.local.set({ [`pref_${hoveredName}`]: chosenProf });

        const newMain = buildPopupDataFromTeacher(chosenProf);

        const tuftsArr = (currentData as any).tuftsArr || [];
        const allArr = (currentData as any).allArr || [];

        let shownArr = tuftsArr;
        if (selectedUniversity === "all") {
          shownArr = allArr;
        }

        newMain.otherMatches = shownArr
          .filter((t: { id: string }) => t.id !== newMain.id)
          .map(buildPopupDataFromTeacher);

        (newMain as any).tuftsArr = tuftsArr;
        (newMain as any).allArr = allArr;

        showPopup(
          professorDiv,
          newMain,
          hoveredName,
          "all",
          selectedUniversity
        );
      } catch (error) {
        console.error("Failed to parse data-oth JSON:", error, profJson);
      }
    });
  });
}

function computeRatingsDistribution(ratings: any[]) {
  const dist = { r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, total: 0 };

  for (const r of ratings) {
    const q = Math.round(r.qualityRating || 0);
    if (q >= 1 && q <= 5) {
      dist[`r${q}` as "r1"]++;
    }
    dist.total++;
  }
  return dist;
}

function computeNewAverages(ratings: any[]) {
  if (!ratings.length) {
    return {
      avgRatingRounded: 0,
      avgDifficulty: 0,
    };
  }
  let sumQuality = 0;
  let sumDiff = 0;
  for (const r of ratings) {
    sumQuality += r.qualityRating || 0;
    sumDiff += r.difficultyRatingRounded || 0;
  }
  const avgQ = sumQuality / ratings.length;
  const avgD = sumDiff / ratings.length;
  return {
    avgRatingRounded: Math.round(avgQ * 10) / 10,
    avgDifficulty: Math.round(avgD * 10) / 10,
  };
}

function buildPopupDataFromTeacher(t: Teacher): PopupData {
  return {
    ...t,
    allRatings: t.ratings,
    otherMatches: [],
  };
}

async function callBackgroundRMP(
  name: string,
  schoolId: string,
  maxResults: number
) {
  return new Promise<Teacher[]>((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "FETCH_PROFESSOR_INFO",
        name,
        schoolId,
        maxResults,
      },
      (response: any) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error with background script:",
            chrome.runtime.lastError.message
          );
          return resolve([]);
        }
        if (!response || !Array.isArray(response.teachers)) {
          console.error("No teachers array from background script");
          return resolve([]);
        }
        resolve(response.teachers);
      }
    );
  });
}

async function processProfessorElement(professorDiv: HTMLElement) {
  if (observedElements.has(professorDiv)) return;
  observedElements.add(professorDiv);

  professorDiv.style.outline = "2px solid grey";

  professorDiv.addEventListener("mouseenter", async () => {
    const professorName = professorDiv.textContent?.trim() || "";
    if (professorName === "STAFF" || !professorName) return;

    const tuftsArr = await parseAndFetchTeachers(
      professorName,
      "U2Nob29sLTEwNDA="
    );
    const allArr = await parseAndFetchTeachers(professorName, "");

    if (!tuftsArr.length && !allArr.length) return;

    const combined = mergeTeacherArrays(tuftsArr, allArr);

    const prefKey = `pref_${professorName}`;
    const stored = await chrome.storage.local.get(prefKey);

    let mainTeacher = combined[0];
    if (stored[prefKey]) {
      const found = combined.find((t) => t.id === stored[prefKey].id);
      if (found) mainTeacher = found;
    }

    const mainData = buildPopupDataFromTeacher(mainTeacher);

    (mainData as any).tuftsArr = tuftsArr;
    (mainData as any).allArr = allArr;

    mainData.otherMatches = tuftsArr
      .filter((t) => t.id !== mainTeacher.id)
      .map(buildPopupDataFromTeacher);

    showPopup(professorDiv, mainData, professorName, "all", "tufts");
  });
}

function mergeTeacherArrays(a: Teacher[], b: Teacher[]): Teacher[] {
  const map = new Map<string, Teacher>();
  for (const t of a) map.set(t.id, t);
  for (const t of b) map.set(t.id, t);
  return Array.from(map.values());
}

let genericObserverStarted = false;

function monitorForNewProfessorElements() {
  if (genericObserverStarted) return;
  genericObserverStarted = true;

  document.querySelectorAll<HTMLElement>(".tfp-ins").forEach((el) => {
    processProfessorElement(el);
  });

  const observer = new MutationObserver((_mutations) => {
    document.querySelectorAll<HTMLElement>(".tfp-ins").forEach((el) => {
      processProfessorElement(el);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}

function startWhen(selector: string, starter: () => void) {
  if (document.querySelector(selector)) return starter();
  const obs = new MutationObserver(() => {
    if (document.querySelector(selector)) {
      obs.disconnect();
      starter();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

startWhen(
  "#TFP_calendar_layout, #tfp_calendar_wrapper, #TFP_calendar_qvw",
  monitorCalendarFacultyElements
);
startWhen("#TFP_cart_section, .tfp-qcart", monitorCartFacultyElements);

function runExtensionScript() {
  chrome.storage.local.get("extensionEnabled", (data) => {
    if (data.extensionEnabled === false) return;

    monitorForNewProfessorElements();

    const isCart = isCartPage();
    const isCalendar = isCalendarPage();

    if (isCart) {
      monitorForNewProfessorElements();
      monitorCartFacultyElements();
    }

    if (isCalendar) {
      monitorCalendarFacultyElements();
    }
  });
}

runExtensionScript();

window.addEventListener("hashchange", () => {
  runExtensionScript();
});

function attachToggleUniversityClick(
  popup: HTMLElement,
  hoveredName: string,
  professorDiv: HTMLElement,
  currentData: PopupData
) {
  const toggleButtons = popup.querySelectorAll(".toggle-university-option");
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const button = evt.currentTarget as HTMLElement;
      const selection = button.getAttribute("data-value") || "tufts";

      const mainTeacher = buildPopupDataFromTeacher(currentData);

      const tuftsArr = (currentData as any).tuftsArr || [];
      const allArr = (currentData as any).allArr || [];

      let chosenArray = tuftsArr;
      if (selection === "all") {
        chosenArray = allArr;
      }

      const filtered = chosenArray.filter(
        (t: Teacher) => t.id !== mainTeacher.id
      );
      mainTeacher.otherMatches = filtered.map(buildPopupDataFromTeacher);

      (mainTeacher as any).tuftsArr = tuftsArr;
      (mainTeacher as any).allArr = allArr;

      showPopup(professorDiv, mainTeacher, hoveredName, "all", selection);
    });
  });
}

function isCartPage(): boolean {
  const href = window.location.href;
  return /SSR_SSENRL_CART/i.test(href) || /#cart/i.test(window.location.hash);
}

function isCalendarPage(): boolean {
  return !!(
    document.getElementById("TFP_calendar_layout") ||
    document.getElementById("tfp_calendar_wrapper") ||
    document.getElementById("TFP_calendar_qvw")
  );
}

function unique<T extends Element>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function selectCartProfessorElements(
  root: Document | HTMLElement = document
): HTMLElement[] {
  const hits: HTMLElement[] = [];

  root.querySelectorAll<HTMLElement>(".tfp-ins, div.tfp-ins").forEach((el) => {
    if (el.textContent && /\w/.test(el.textContent)) hits.push(el);
  });

  const tables = Array.from(root.querySelectorAll("table"));
  tables.forEach((table) => {
    const headerRow =
      table.querySelector("thead tr") || table.querySelector("tbody tr");
    if (!headerRow) return;

    const headers = Array.from(headerRow.querySelectorAll("th"));
    const facultyIdx = headers.findIndex((th) =>
      /faculty/i.test(th.textContent || "")
    );
    if (facultyIdx === -1) return;

    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    bodyRows.forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll("td"));
      const cell = tds[facultyIdx];
      if (!cell) return;

      const txt = cell.textContent?.trim() || "";
      if (
        /[A-Za-z]\.\s*[A-Za-z]/.test(txt) ||
        /,/.test(txt) ||
        /\sand\s/i.test(txt)
      ) {
        hits.push(cell as HTMLElement);
      }
    });
  });

  return unique(hits);
}

function monitorCartFacultyElements() {
  selectCartProfessorElements().forEach((el) => processProfessorElement(el));

  const observer = new MutationObserver((_mutations) => {
    selectCartProfessorElements().forEach((el) => processProfessorElement(el));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function selectCalendarProfessorElements(
  root: Document | HTMLElement = document
): HTMLElement[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "#TFP_ClsSrch_dialog .tfp-ins",
        ".tfp-results-sections .tfp-ins",
        ".tfp-meet-location .tfp-ins",
      ].join(", ")
    )
  );

  const clean = nodes.filter((el) => {
    const txt = (el.textContent || "").trim();
    return txt.length > 0 && txt.toUpperCase() !== "STAFF";
  });

  return unique(clean);
}

function monitorCalendarFacultyElements() {
  selectCalendarProfessorElements().forEach((el) =>
    processProfessorElement(el)
  );

  const observer = new MutationObserver((_mutations) => {
    selectCalendarProfessorElements().forEach((el) =>
      processProfessorElement(el)
    );
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
