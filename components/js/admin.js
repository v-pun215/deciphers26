(() => {
  const popup = document.getElementById("popupContainer");
  const levelCards = document.querySelectorAll(".level-card[data-level]");
  const markupInput = document.getElementById("inputField");
  const preview = document.getElementById("displayBox");
  const answerInput = document.getElementById("answerField");
  const idInput = document.getElementById("levelId");
  const title = document.getElementById("level_id");
  let editingLevelId = "";

  if (!popup || !markupInput || !preview || !answerInput || !idInput || !title) return;

  function showPopup(level) {
    const current = level || {};
    editingLevelId = current.ID || current.id || "";
    idInput.value = editingLevelId;
    idInput.readOnly = Boolean(editingLevelId);
    title.textContent = editingLevelId ? `Edit Level ${editingLevelId}` : "New Level";
    markupInput.value = current.Markup || current.markup || "";
    answerInput.value = current.Answer || current.answer || "";
    renderPreview();
    popup.classList.remove("hidden");
  }

  function renderPreview() {
    const source = markupInput.value || "";
    preview.innerHTML = typeof marked !== "undefined" ? marked.parse(source) : source;
  }

  function closePopup() {
    popup.classList.add("hidden");
  }

  function nextLevelId() {
    const levels = Array.isArray(window.__LEVELS__) ? window.__LEVELS__ : [];
    let maxId = -1;
    levels.forEach((level) => {
      const id = String(level.ID || level.id || "");
      const match = id.match(/^cryptic-(\d+)$/i);
      if (match) maxId = Math.max(maxId, Number(match[1]));
    });
    return `cryptic-${maxId + 1}`;
  }

  async function request(url, options) {
    const result = await window.sudo.fetchWithCSRF(url, options);
    const payload = result.parsed.json || {};
    if (!result.res.ok || payload.error) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload;
  }

  window.closePopup = closePopup;
  window.submitForm = async () => {
    const data = new URLSearchParams();
    data.set("level", idInput.value.trim());
    data.set("markup", markupInput.value.trim());
    data.set("answer", answerInput.value.trim());
    try {
      await request("/api/admin/levels", { method: "POST", body: data });
      window.sudo.toast("Level saved.", "success");
      window.location.reload();
    } catch (error) {
      window.sudo.toast(error.message || "Could not save level.", "error");
    }
  };
  window.deleteLevel = async () => {
    const id = editingLevelId || idInput.value.trim();
    if (!id) return window.sudo.toast("Choose a level first.", "error");
    if (!window.confirm(`Delete level ${id}?`)) return;
    try {
      await request(`/api/admin/levels/${encodeURIComponent(id)}`, { method: "DELETE" });
      window.sudo.toast("Level deleted.", "success");
      window.location.reload();
    } catch (error) {
      window.sudo.toast(error.message || "Could not delete level.", "error");
    }
  };

  window.submitAnnouncement = async () => {
    const content = document.getElementById("announcementContent");
    const id = document.getElementById("announcementId");
    if (!content || !id) return;
    const data = new URLSearchParams({ content: content.value.trim(), id: id.value.trim() });
    try {
      await request("/api/admin/announcements", { method: "POST", body: data });
      window.sudo.toast("Announcement saved.", "success");
      window.location.reload();
    } catch (error) {
      window.sudo.toast(error.message || "Could not save announcement.", "error");
    }
  };

  document.getElementById("new-level-btn")?.addEventListener("click", () => {
    const id = nextLevelId();
    showPopup({});
    idInput.value = id;
    idInput.readOnly = false;
    title.textContent = `New Level ${id}`;
    editingLevelId = "";
  });

  levelCards.forEach((card) => {
    card.addEventListener("click", () => {
      try {
        showPopup(JSON.parse(card.dataset.level || "{}"));
      } catch (error) {
        window.sudo.toast("Could not load level details.", "error");
      }
    });
  });

  markupInput.addEventListener("input", renderPreview);
  document.querySelectorAll(".delete-announcement").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      if (!id || !window.confirm("Delete this announcement?")) return;
      try {
        await request(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
        window.location.reload();
      } catch (error) {
        window.sudo.toast(error.message || "Could not delete announcement.", "error");
      }
    });
  });
  document.getElementById("new-announcement-btn")?.addEventListener("click", () => {
    document.getElementById("announcementContent")?.focus();
  });
})();
