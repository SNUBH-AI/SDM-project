// assets/js/script.js

document.addEventListener("DOMContentLoaded", () => {
  const pages = Array.from(document.querySelectorAll(".survey-page[data-page]"));
  const form = document.getElementById("surveyForm");
  if (!form || pages.length === 0) return;

  let currentPage = 0;

  function initQuestionNumbering() {
    pages.forEach((pageEl) => {
      const ol = pageEl.querySelector(".likert-box ol");
      if (!ol) return;

      const startAttr = parseInt(ol.getAttribute("start") || "1", 10);
      const qStart = Number.isFinite(startAttr) ? Math.max(0, startAttr - 1) : 0;
      ol.style.setProperty("--q-start", String(qStart));
    });
  }

  function isPageCompleted(pageEl) {
    const radios = Array.from(pageEl.querySelectorAll('input[type="radio"]'));
    if (radios.length === 0) return true;

    const names = [...new Set(radios.map((r) => r.name).filter(Boolean))];
    if (names.length === 0) return true;

    return names.every((name) =>
      pageEl.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]:checked`)
    );
  }

  function updateButtonsForPage(pageEl) {
    const completed = isPageCompleted(pageEl);

    const nextBtn = pageEl.querySelector(".next-btn");
    if (nextBtn) nextBtn.classList.toggle("active", completed);

    const submitBtn = pageEl.querySelector(".submit");
    if (submitBtn) submitBtn.classList.toggle("active", completed);
  }

  function updateDots() {
    const pageEl = pages[currentPage];
    if (!pageEl) return;

    const dots = pageEl.querySelectorAll(".page-indicator .dot");
    if (!dots || dots.length === 0) return;

    dots.forEach((dot) => dot.classList.remove("active"));
    if (dots[currentPage]) dots[currentPage].classList.add("active");
  }

  function showPage(index) {
    pages.forEach((page, i) => {
      page.style.display = i === index ? "block" : "none";
    });

    currentPage = index;

    updateButtonsForPage(pages[currentPage]);
    updateDots();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  form.addEventListener("change", (e) => {
    if (!e.target.matches('input[type="radio"]')) return;
    const pageEl = e.target.closest(".survey-page[data-page]");
    if (!pageEl) return;
    updateButtonsForPage(pageEl);
  });

  document.querySelectorAll(".next-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const pageEl = btn.closest(".survey-page[data-page]");
      if (!pageEl) return;

      if (!isPageCompleted(pageEl)) {
        alert("모든 문항에 답변을 선택해주세요.");
        return;
      }

      if (currentPage < pages.length - 1) showPage(currentPage + 1);
    });
  });

  document.querySelectorAll(".prev-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentPage > 0) showPage(currentPage - 1);
    });
  });

  document.querySelectorAll(".submit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const pageEl = btn.closest(".survey-page[data-page]");
      if (!pageEl) return;

      if (!isPageCompleted(pageEl)) {
        alert("모든 문항에 답변을 선택해주세요.");
        return;
      }

      form.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const answers = [];
    for (let i = 1; i <= 18; i++) {
      const checked = form.querySelector(`input[type="radio"][name="q${i}"]:checked`);
      if (!checked) {
        alert("모든 문항에 답변을 선택해주세요.");
        return;
      }
      answers.push(parseFloat(checked.value));
    }

    localStorage.setItem("sdm_answers_v1", JSON.stringify(answers));

    const avg = answers.reduce((a, b) => a + b, 0) / answers.length;
    localStorage.setItem("dialysisResult", avg >= 3.5 ? "PD" : "HD");

    const clusterProfiles = {
      1: [4.70, 4.67, 4.59, 4.58, 4.48, 4.26, 3.39, 3.80, 2.88, 3.92, 1.80, 1.22, 2.33, 2.70, 3.39, 2.39, 2.68, 2.36],
      2: [4.53, 4.60, 4.39, 4.51, 4.43, 4.08, 3.58, 3.72, 2.87, 3.98, 2.27, 4.21, 2.46, 2.76, 3.31, 2.69, 2.49, 2.37],
      3: [3.97, 3.96, 3.65, 3.92, 3.61, 3.84, 2.77, 3.16, 2.57, 3.15, 1.97, 1.42, 3.77, 3.20, 4.16, 2.87, 2.96, 3.44],
      4: [4.91, 4.91, 4.81, 4.89, 4.81, 4.89, 3.34, 3.76, 2.80, 4.06, 2.14, 1.17, 4.34, 3.59, 4.70, 2.97, 3.18, 3.30],
      5: [4.87, 4.90, 4.89, 4.81, 4.89, 4.87, 3.21, 3.50, 2.89, 3.92, 2.00, 4.23, 4.35, 3.08, 4.46, 2.89, 2.69, 2.51],
      6: [4.91, 4.90, 4.81, 4.91, 4.87, 4.71, 4.09, 4.26, 3.33, 4.38, 3.48, 4.51, 4.13, 3.13, 4.28, 3.70, 3.88, 3.16],
    };

    // 수정: 1~5 고정 범위로 정규화 (기존 개별 정규화 방식 제거)
    // 기존 방식은 각 벡터의 min/max가 달라 실제 점수 차이가 사라지는 문제가 있었음
    function normalize(arr) {
      return arr.map((v) => (v - 1) / 4); // 항상 1~5 기준으로 고정
    }

    const userNorm = normalize(answers);
    const distances = {};

    for (const [cluster, profile] of Object.entries(clusterProfiles)) {
      const clusterNorm = normalize(profile);
      const distance = Math.sqrt(
        clusterNorm.reduce((sum, val, idx) => {
          const u = userNorm[idx] ?? 0;
          return sum + Math.pow(u - val, 2);
        }, 0)
      );
      distances[cluster] = distance;
    }

    const closestCluster = Object.entries(distances).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
    localStorage.setItem("clusterId", String(closestCluster));

    window.location.href = "info.html";
  });

  initQuestionNumbering();
  showPage(0);
});
