// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Works list: floating image preview that follows the cursor
const preview = document.getElementById("work-preview");
const previewImg = preview.querySelector("img");
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (fine) {
  let raf = null;
  let x = 0, y = 0;

  const move = () => {
    preview.style.left = x + "px";
    preview.style.top = y + "px";
    raf = null;
  };

  document.querySelectorAll(".work-list a").forEach((link) => {
    link.addEventListener("mouseenter", () => {
      const src = link.dataset.img;
      if (src && previewImg.getAttribute("src") !== src) previewImg.src = src;
      preview.classList.add("on");
    });
    link.addEventListener("mouseleave", () => preview.classList.remove("on"));
    link.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(move);
    });
  });
}

// Path: scroll-driven chapters — one job at a time, with progress rail
const path = document.getElementById("path");
const chapters = path.querySelectorAll(".chapter");
const pathCount = document.getElementById("path-count");
const railFill = document.getElementById("path-rail-fill");
let currentChapter = 0;
let pathRaf = null;

const updatePath = () => {
  pathRaf = null;
  const rect = path.getBoundingClientRect();
  const scrollable = path.offsetHeight - window.innerHeight;
  const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
  const idx = Math.min(chapters.length - 1, Math.floor(progress * chapters.length));

  railFill.style.transform = `scaleX(${progress})`;

  if (idx !== currentChapter) {
    chapters[currentChapter].classList.remove("active");
    chapters[idx].classList.add("active");
    currentChapter = idx;
    pathCount.textContent =
      String(idx + 1).padStart(2, "0") + " / " + String(chapters.length).padStart(2, "0");
  }
};

const onScroll = () => {
  if (!pathRaf) pathRaf = requestAnimationFrame(updatePath);
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
updatePath();
