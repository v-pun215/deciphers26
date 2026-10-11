(() => {
  const markup = document.getElementById("level-markup");
  const form = document.getElementById("submit-form");
  if (!markup || !form) return;

  const answerInput = document.getElementById("answer-input");
  const sendButton = form.querySelector(".send-button");
  let answerCooldownUntil = 0;
  let answerCooldownTimer = null;
  let answerSending = false;
  const answerDefaultPlaceholder = answerInput
    ? answerInput.getAttribute("placeholder") || ""
    : "";
  const sendRow = form.querySelector(".send-row");
  const sendWait = form.querySelector(".send-wait");

  const levelObj = window.__LEVEL__ || window.__LEVEL__ || {};
  const md =
    levelObj.markup || markup.dataset.markup || markup.textContent || "";
  markup.innerHTML = marked.parse(md);
  markup.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noreferrer";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (answerSending || Date.now() < answerCooldownUntil) return;

    const submittedAnswer = (answerInput ? answerInput.value : "").trim();
    if (!submittedAnswer) {
      window.sudo.flashMessage("play-message", "Answer is required.", "error");
      window.sudo.toast("Answer is required.", "error");
      return;
    }

    const body = new URLSearchParams();
    body.append("answer", submittedAnswer);
    const qp = new URLSearchParams(window.location.search);
    const levelType = qp.get("type") || "logical";
    body.append("type", levelType);

    answerSending = true;
    updateAnswerComposer();
    startAnswerCooldown(3000);
    try {
      const { res: response, parsed } = await window.sudo.fetchWithCSRF(
        "/api/submit",
        { method: "POST", body },
      );
      const payload =
        parsed.json || (parsed.text ? { error: parsed.text } : {});
      if (!response.ok || payload.error) {
        window.sudo.flashMessage(
          "play-message",
          payload.error || "Could not submit answer.",
          "error",
        );
        window.sudo.toast(payload.error || "Could not submit answer.", "error");
        return;
      }
      if (payload.success) {
        window.sudo.flashMessage(
          "play-message",
          "Correct answer. Loading the next level...",
          "success",
        );
        window.sudo.toast(
          "Correct answer. Loading the next level...",
          "success",
        );
        if (window.sudoConfetti) window.sudoConfetti();
        setTimeout(() => window.location.reload(), 2500);
        return;
      }
      window.sudo.flashMessage(
        "play-message",
        "Incorrect answer. Try again.",
        "error",
      );
      window.sudo.toast("Incorrect answer. Try again.", "error");
    } catch (err) {
      console.error(err);
      window.sudo.flashMessage(
        "play-message",
        "Could not submit answer.",
        "error",
      );
      window.sudo.toast("Could not submit answer.", "error");
    } finally {
      answerSending = false;
      updateAnswerComposer();
    }
  });

  function getAnswerCooldownRemainingMs() {
    return Math.max(0, answerCooldownUntil - Date.now());
  }

  function updateAnswerComposer() {
    const cooldownActive = getAnswerCooldownRemainingMs() > 0;
    if (answerInput) {
      if (answerSending) {
        answerInput.disabled = true;
        answerInput.placeholder = "Sending...";
      } else if (cooldownActive) {
        answerInput.disabled = false;
        const secs = Math.max(
          1,
          Math.ceil(getAnswerCooldownRemainingMs() / 1000),
        );
        answerInput.placeholder = `Please wait ${secs} seconds more`;
        if (sendWait) sendWait.textContent = `Please wait ${secs} seconds more`;
        if (sendRow) sendRow.classList.add("is-cooldown");
      } else {
        answerInput.disabled = false;
        answerInput.placeholder = answerDefaultPlaceholder;
        if (sendWait) sendWait.textContent = "";
        if (sendRow) sendRow.classList.remove("is-cooldown");
      }
    }
    if (sendButton) {
      sendButton.disabled = answerSending || cooldownActive;
    }
  }

  function startAnswerCooldown(durationMs) {
    answerCooldownUntil = Date.now() + durationMs;
    if (answerCooldownTimer) clearInterval(answerCooldownTimer);
    if (answerInput) answerInput.value = "";
    updateAnswerComposer();
    answerCooldownTimer = setInterval(() => {
      if (Date.now() >= answerCooldownUntil) {
        clearInterval(answerCooldownTimer);
        answerCooldownTimer = null;
        answerCooldownUntil = 0;
        updateAnswerComposer();
        return;
      }
      updateAnswerComposer();
    }, 250);
  }

  const decor = document.getElementById("decorSvg");
  const headerEl = document.querySelector(".site-header");
  function updateDecor() {
    if (!decor || !headerEl) return;
    const headerRect = headerEl.getBoundingClientRect();
    const top = Math.max(8, headerRect.bottom + 8);
    decor.style.top = `${top}px`;
  }
  updateDecor();
  window.addEventListener("scroll", updateDecor, { passive: true });
  window.addEventListener("resize", updateDecor);
})();
