/**
 * CloverBot Chat Widget v2.0
 * Branded AI support agent for MyClover.Tech
 *
 * EMBED ON YOUR SITE:
 *   <script src="https://YOUR_SERVER:8400/static/cloverbot.js" data-api-url="https://YOUR_SERVER:8400"></script>
 *
 * The data-api-url tells the widget where CloverBot's API lives.
 * If omitted, it defaults to the same origin the script is served from.
 */
(function () {
    "use strict";

    // -----------------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------------
    var scriptTag = document.currentScript || document.querySelector('script[src*="cloverbot"]');
    var API_URL = (scriptTag && scriptTag.getAttribute("data-api-url")) || "";

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    var sessionId = "";
    var isOpen = false;
    var isLoading = false;
    var hasGreeted = false;
    var leadCaptured = false;
    var lastSender = "";
    var messageCount = 0;

    // -----------------------------------------------------------------------
    // Styles - Slack-inspired, dark premium UI
    // -----------------------------------------------------------------------
    var STYLES = '\
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");\
    \
    #cloverbot-widget *, #cloverbot-widget *::before, #cloverbot-widget *::after { box-sizing: border-box; margin: 0; padding: 0; }\
    #cloverbot-widget {\
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\
        font-size: 14px;\
        line-height: 1.5;\
        position: fixed;\
        bottom: 24px;\
        right: 24px;\
        z-index: 99999;\
        -webkit-font-smoothing: antialiased;\
        -moz-osx-font-smoothing: grayscale;\
    }\
    \
    /* ---- Floating Action Button ---- */\
    #cb-fab {\
        width: 64px; height: 64px;\
        border-radius: 18px;\
        background: linear-gradient(145deg, #10b981, #059669);\
        border: none;\
        cursor: pointer;\
        display: flex; align-items: center; justify-content: center;\
        box-shadow:\
            0 2px 4px rgba(0,0,0,0.15),\
            0 8px 24px rgba(16,185,129,0.25),\
            inset 0 1px 0 rgba(255,255,255,0.15);\
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);\
        position: relative;\
        overflow: hidden;\
    }\
    #cb-fab::before {\
        content: "";\
        position: absolute;\
        inset: 0;\
        background: linear-gradient(145deg, rgba(255,255,255,0.1), transparent);\
        border-radius: inherit;\
        pointer-events: none;\
    }\
    #cb-fab:hover {\
        transform: scale(1.08);\
        box-shadow:\
            0 4px 8px rgba(0,0,0,0.2),\
            0 12px 32px rgba(16,185,129,0.35),\
            inset 0 1px 0 rgba(255,255,255,0.2);\
    }\
    #cb-fab:active { transform: scale(0.96); }\
    #cb-fab .cb-fab-icon {\
        width: 28px; height: 28px;\
        transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);\
        fill: white;\
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));\
    }\
    #cb-fab.open .cb-fab-chat { transform: scale(0) rotate(90deg); opacity: 0; position: absolute; }\
    #cb-fab.open .cb-fab-close { transform: scale(1) rotate(0deg); opacity: 1; }\
    #cb-fab .cb-fab-close { transform: scale(0) rotate(-90deg); opacity: 0; position: absolute; }\
    \
    #cb-fab .cb-pulse {\
        position: absolute; inset: -4px;\
        border-radius: 22px;\
        border: 2px solid rgba(16, 185, 129, 0.5);\
        animation: cbPulse 2.5s ease-out infinite;\
    }\
    #cb-fab.open .cb-pulse { display: none; }\
    @keyframes cbPulse {\
        0% { transform: scale(0.9); opacity: 0.8; }\
        100% { transform: scale(1.3); opacity: 0; }\
    }\
    \
    #cb-fab .cb-badge {\
        position: absolute; top: -4px; right: -4px;\
        width: 20px; height: 20px;\
        background: #ef4444;\
        border: 2.5px solid #0f172a;\
        border-radius: 50%;\
        font-size: 10px; font-weight: 700; color: white;\
        display: none; align-items: center; justify-content: center;\
        animation: cbBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);\
    }\
    @keyframes cbBadgePop { from { transform: scale(0); } to { transform: scale(1); } }\
    \
    /* ---- Chat Window ---- */\
    #cb-window {\
        display: none;\
        position: absolute;\
        bottom: 78px; right: 0;\
        width: 420px;\
        max-width: calc(100vw - 32px);\
        height: 600px;\
        max-height: calc(100vh - 120px);\
        background: #0c1220;\
        border-radius: 20px;\
        overflow: hidden;\
        flex-direction: column;\
        box-shadow:\
            0 0 0 1px rgba(255,255,255,0.06),\
            0 4px 6px rgba(0,0,0,0.15),\
            0 16px 48px rgba(0,0,0,0.45),\
            0 32px 80px rgba(0,0,0,0.3);\
        transform-origin: bottom right;\
    }\
    #cb-window.open {\
        display: flex;\
        animation: cbWindowIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;\
    }\
    #cb-window.closing {\
        animation: cbWindowOut 0.25s ease-in forwards;\
    }\
    @keyframes cbWindowIn {\
        from { opacity: 0; transform: scale(0.85) translateY(16px); }\
        to { opacity: 1; transform: scale(1) translateY(0); }\
    }\
    @keyframes cbWindowOut {\
        from { opacity: 1; transform: scale(1) translateY(0); }\
        to { opacity: 0; transform: scale(0.85) translateY(16px); }\
    }\
    \
    /* ---- Header ---- */\
    #cb-header {\
        padding: 20px 22px;\
        background: linear-gradient(170deg, #0d2818 0%, #0c1220 100%);\
        display: flex; align-items: center; gap: 14px;\
        border-bottom: 1px solid rgba(255,255,255,0.06);\
        position: relative;\
    }\
    #cb-header::after {\
        content: "";\
        position: absolute;\
        bottom: 0; left: 22px; right: 22px;\
        height: 1px;\
        background: linear-gradient(90deg, transparent, rgba(16,185,129,0.2), transparent);\
    }\
    .cb-avatar {\
        width: 42px; height: 42px;\
        border-radius: 12px;\
        background: linear-gradient(135deg, #10b981, #059669);\
        display: flex; align-items: center; justify-content: center;\
        flex-shrink: 0;\
        box-shadow: 0 2px 8px rgba(16,185,129,0.3);\
        position: relative;\
    }\
    .cb-avatar svg { width: 22px; height: 22px; fill: white; }\
    .cb-avatar .cb-status-dot {\
        position: absolute; bottom: -2px; right: -2px;\
        width: 12px; height: 12px;\
        background: #22c55e;\
        border: 2.5px solid #0c1220;\
        border-radius: 50%;\
    }\
    #cb-header .cb-header-info { flex: 1; }\
    #cb-header .cb-header-name {\
        color: #f8fafc;\
        font-weight: 700;\
        font-size: 16px;\
        letter-spacing: -0.01em;\
    }\
    #cb-header .cb-header-status {\
        color: #4ade80;\
        font-size: 12px;\
        font-weight: 500;\
        margin-top: 1px;\
        letter-spacing: 0.01em;\
    }\
    #cb-header .cb-header-close {\
        width: 32px; height: 32px;\
        border-radius: 8px;\
        border: none;\
        background: transparent;\
        cursor: pointer;\
        display: flex; align-items: center; justify-content: center;\
        transition: all 0.15s ease;\
        color: #64748b;\
    }\
    #cb-header .cb-header-close:hover { background: rgba(255,255,255,0.06); color: #94a3b8; }\
    #cb-header .cb-header-close svg { width: 18px; height: 18px; fill: currentColor; }\
    \
    /* ---- Messages Area ---- */\
    #cb-messages {\
        flex: 1;\
        overflow-y: auto;\
        padding: 20px;\
        display: flex;\
        flex-direction: column;\
        gap: 2px;\
        scroll-behavior: smooth;\
        overscroll-behavior: contain;\
    }\
    #cb-messages::-webkit-scrollbar { width: 6px; }\
    #cb-messages::-webkit-scrollbar-track { background: transparent; }\
    #cb-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }\
    #cb-messages::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }\
    \
    /* ---- Message Bubbles ---- */\
    .cb-msg-row {\
        display: flex;\
        gap: 10px;\
        max-width: 88%;\
        animation: cbMsgIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;\
    }\
    .cb-msg-row.bot { align-self: flex-start; }\
    .cb-msg-row.user { align-self: flex-end; flex-direction: row-reverse; }\
    .cb-msg-row.grouped { margin-top: 0; }\
    .cb-msg-row.grouped .cb-msg-avatar { visibility: hidden; }\
    @keyframes cbMsgIn {\
        from { opacity: 0; transform: translateY(8px) scale(0.97); }\
        to { opacity: 1; transform: translateY(0) scale(1); }\
    }\
    \
    .cb-msg-avatar {\
        width: 32px; height: 32px;\
        border-radius: 10px;\
        flex-shrink: 0;\
        display: flex; align-items: center; justify-content: center;\
        align-self: flex-end;\
        margin-bottom: 2px;\
    }\
    .cb-msg-row.bot .cb-msg-avatar {\
        background: linear-gradient(135deg, #10b981, #059669);\
    }\
    .cb-msg-row.bot .cb-msg-avatar svg { width: 16px; height: 16px; fill: white; }\
    .cb-msg-row.user .cb-msg-avatar {\
        background: linear-gradient(135deg, #3b82f6, #2563eb);\
        font-size: 13px; font-weight: 600; color: white;\
    }\
    \
    .cb-msg-content { display: flex; flex-direction: column; gap: 3px; }\
    \
    .cb-bubble {\
        padding: 10px 16px;\
        border-radius: 16px;\
        word-wrap: break-word;\
        overflow-wrap: break-word;\
        position: relative;\
        font-size: 14px;\
        line-height: 1.55;\
    }\
    .cb-msg-row.bot .cb-bubble {\
        background: #161e2e;\
        color: #e2e8f0;\
        border: 1px solid rgba(255,255,255,0.04);\
        border-bottom-left-radius: 6px;\
    }\
    .cb-msg-row.bot.grouped .cb-bubble { border-top-left-radius: 6px; }\
    .cb-msg-row.user .cb-bubble {\
        background: linear-gradient(145deg, #10b981, #059669);\
        color: #ffffff;\
        border-bottom-right-radius: 6px;\
    }\
    .cb-msg-row.user.grouped .cb-bubble { border-top-right-radius: 6px; }\
    \
    /* Bot message content styling */\
    .cb-bubble a { color: #4ade80; text-decoration: none; border-bottom: 1px solid rgba(74,222,128,0.3); transition: border-color 0.15s; }\
    .cb-bubble a:hover { border-bottom-color: #4ade80; }\
    .cb-bubble code {\
        background: rgba(0,0,0,0.3);\
        padding: 1.5px 6px;\
        border-radius: 5px;\
        font-size: 13px;\
        font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;\
    }\
    .cb-bubble pre {\
        background: rgba(0,0,0,0.35);\
        padding: 12px 14px;\
        border-radius: 10px;\
        overflow-x: auto;\
        margin: 8px 0;\
        font-size: 13px;\
        border: 1px solid rgba(255,255,255,0.04);\
    }\
    .cb-bubble pre code { background: transparent; padding: 0; }\
    .cb-bubble strong, .cb-bubble b { color: #f0fdf4; font-weight: 600; }\
    .cb-bubble ul, .cb-bubble ol { margin: 6px 0 6px 20px; }\
    .cb-bubble li { margin: 3px 0; }\
    .cb-bubble p { margin: 0; }\
    .cb-bubble p + p { margin-top: 8px; }\
    .cb-bubble blockquote {\
        border-left: 3px solid #10b981;\
        margin: 8px 0;\
        padding: 4px 12px;\
        color: #94a3b8;\
        font-style: italic;\
    }\
    .cb-bubble h3, .cb-bubble h4 { color: #f0fdf4; font-size: 14px; margin: 10px 0 4px 0; }\
    \
    /* Timestamp */\
    .cb-time {\
        font-size: 11px;\
        color: #475569;\
        padding: 0 4px;\
        opacity: 0;\
        transition: opacity 0.2s;\
        white-space: nowrap;\
        user-select: none;\
    }\
    .cb-msg-row:hover .cb-time { opacity: 1; }\
    .cb-msg-row.user .cb-time { text-align: right; }\
    \
    /* ---- Typing Indicator ---- */\
    .cb-typing-row {\
        display: flex; gap: 10px; align-self: flex-start;\
        animation: cbMsgIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);\
    }\
    .cb-typing-bubble {\
        background: #161e2e;\
        border: 1px solid rgba(255,255,255,0.04);\
        padding: 14px 20px;\
        border-radius: 16px;\
        border-bottom-left-radius: 6px;\
        display: flex; gap: 5px; align-items: center;\
    }\
    .cb-typing-bubble span {\
        width: 7px; height: 7px;\
        background: #334155;\
        border-radius: 50%;\
        animation: cbTypingBounce 1.4s ease-in-out infinite;\
    }\
    .cb-typing-bubble span:nth-child(1) { animation-delay: 0s; }\
    .cb-typing-bubble span:nth-child(2) { animation-delay: 0.15s; }\
    .cb-typing-bubble span:nth-child(3) { animation-delay: 0.3s; }\
    @keyframes cbTypingBounce {\
        0%, 60%, 100% { transform: translateY(0); background: #334155; }\
        30% { transform: translateY(-5px); background: #10b981; }\
    }\
    \
    /* ---- Welcome Screen ---- */\
    #cb-welcome {\
        padding: 28px 22px;\
        text-align: center;\
        display: flex;\
        flex-direction: column;\
        align-items: center;\
        gap: 16px;\
    }\
    #cb-welcome .cb-welcome-icon {\
        width: 56px; height: 56px;\
        border-radius: 16px;\
        background: linear-gradient(135deg, #10b981, #059669);\
        display: flex; align-items: center; justify-content: center;\
        box-shadow: 0 4px 16px rgba(16,185,129,0.25);\
    }\
    #cb-welcome .cb-welcome-icon svg { width: 28px; height: 28px; fill: white; }\
    #cb-welcome .cb-welcome-title {\
        font-size: 18px; font-weight: 700; color: #f8fafc;\
        letter-spacing: -0.02em;\
    }\
    #cb-welcome .cb-welcome-text {\
        font-size: 14px; color: #94a3b8; line-height: 1.6;\
        max-width: 300px;\
    }\
    \
    /* Quick action pills */\
    #cb-quick-actions {\
        display: flex; flex-wrap: wrap;\
        gap: 8px; justify-content: center;\
        padding: 0 22px 8px;\
    }\
    .cb-quick-pill {\
        padding: 8px 16px;\
        background: rgba(16,185,129,0.08);\
        border: 1px solid rgba(16,185,129,0.15);\
        border-radius: 20px;\
        color: #4ade80;\
        font-size: 13px;\
        font-weight: 500;\
        cursor: pointer;\
        transition: all 0.2s ease;\
        white-space: nowrap;\
    }\
    .cb-quick-pill:hover {\
        background: rgba(16,185,129,0.15);\
        border-color: rgba(16,185,129,0.3);\
        transform: translateY(-1px);\
    }\
    .cb-quick-pill:active { transform: translateY(0); }\
    .cb-quick-pills-hidden { display: none !important; }\
    \
    /* ---- Lead Form ---- */\
    #cb-lead {\
        display: none;\
        padding: 20px 22px;\
        background: linear-gradient(180deg, rgba(16,185,129,0.04), transparent);\
        border-top: 1px solid rgba(255,255,255,0.04);\
    }\
    #cb-lead.active { display: block; }\
    #cb-lead .cb-lead-title {\
        font-size: 13px; font-weight: 600; color: #94a3b8;\
        text-transform: uppercase;\
        letter-spacing: 0.06em;\
        margin-bottom: 12px;\
    }\
    #cb-lead input {\
        width: 100%;\
        padding: 10px 14px;\
        margin-bottom: 8px;\
        background: rgba(255,255,255,0.03);\
        border: 1px solid rgba(255,255,255,0.08);\
        border-radius: 10px;\
        color: #e2e8f0;\
        font-size: 14px;\
        font-family: inherit;\
        outline: none;\
        transition: all 0.2s ease;\
    }\
    #cb-lead input:focus { border-color: rgba(16,185,129,0.5); background: rgba(16,185,129,0.03); }\
    #cb-lead input::placeholder { color: #475569; }\
    #cb-lead button {\
        width: 100%;\
        padding: 10px;\
        margin-top: 4px;\
        background: linear-gradient(145deg, #10b981, #059669);\
        color: white;\
        border: none;\
        border-radius: 10px;\
        cursor: pointer;\
        font-size: 14px;\
        font-weight: 600;\
        font-family: inherit;\
        transition: all 0.2s ease;\
        box-shadow: 0 2px 8px rgba(16,185,129,0.25);\
    }\
    #cb-lead button:hover {\
        box-shadow: 0 4px 16px rgba(16,185,129,0.35);\
        transform: translateY(-1px);\
    }\
    \
    /* ---- Input Area ---- */\
    #cb-input-area {\
        padding: 16px 18px;\
        background: #0c1220;\
        border-top: 1px solid rgba(255,255,255,0.06);\
        display: flex;\
        gap: 10px;\
        align-items: flex-end;\
    }\
    #cb-input {\
        flex: 1;\
        resize: none;\
        border: 1px solid rgba(255,255,255,0.08);\
        background: rgba(255,255,255,0.03);\
        color: #e2e8f0;\
        border-radius: 14px;\
        padding: 11px 16px;\
        font-size: 14px;\
        font-family: inherit;\
        line-height: 1.45;\
        max-height: 120px;\
        outline: none;\
        transition: all 0.2s ease;\
    }\
    #cb-input:focus {\
        border-color: rgba(16,185,129,0.4);\
        background: rgba(255,255,255,0.04);\
        box-shadow: 0 0 0 3px rgba(16,185,129,0.08);\
    }\
    #cb-input::placeholder { color: #475569; }\
    #cb-send {\
        width: 42px; height: 42px;\
        border-radius: 14px;\
        border: none;\
        background: linear-gradient(145deg, #10b981, #059669);\
        cursor: pointer;\
        display: flex; align-items: center; justify-content: center;\
        transition: all 0.2s ease;\
        flex-shrink: 0;\
        box-shadow: 0 2px 8px rgba(16,185,129,0.2);\
    }\
    #cb-send:hover {\
        box-shadow: 0 4px 16px rgba(16,185,129,0.35);\
        transform: translateY(-1px);\
    }\
    #cb-send:active { transform: translateY(0) scale(0.95); }\
    #cb-send:disabled {\
        opacity: 0.3;\
        cursor: not-allowed;\
        transform: none;\
        box-shadow: none;\
    }\
    #cb-send svg {\
        width: 18px; height: 18px;\
        fill: white;\
        transition: transform 0.2s;\
    }\
    #cb-send:not(:disabled):hover svg { transform: translateX(1px); }\
    \
    /* ---- Footer ---- */\
    #cb-footer {\
        text-align: center;\
        padding: 8px;\
        background: #0a0f1a;\
        border-top: 1px solid rgba(255,255,255,0.03);\
    }\
    #cb-footer a {\
        color: #334155;\
        font-size: 11px;\
        text-decoration: none;\
        font-weight: 500;\
        letter-spacing: 0.02em;\
        transition: color 0.2s;\
    }\
    #cb-footer a:hover { color: #10b981; }\
    \
    /* ---- Divider with date ---- */\
    .cb-divider {\
        display: flex; align-items: center;\
        gap: 12px;\
        margin: 16px 0 12px;\
        user-select: none;\
    }\
    .cb-divider::before, .cb-divider::after {\
        content: "";\
        flex: 1;\
        height: 1px;\
        background: rgba(255,255,255,0.06);\
    }\
    .cb-divider span {\
        font-size: 11px;\
        font-weight: 600;\
        color: #475569;\
        text-transform: uppercase;\
        letter-spacing: 0.05em;\
        white-space: nowrap;\
    }\
    \
    /* ---- Responsive ---- */\
    @media (max-width: 480px) {\
        #cloverbot-widget { bottom: 16px; right: 16px; }\
        #cb-window {\
            width: calc(100vw - 24px);\
            right: -8px;\
            bottom: 76px;\
            height: calc(100vh - 100px);\
            max-height: calc(100vh - 100px);\
            border-radius: 16px;\
        }\
    }\
    ';

    // -----------------------------------------------------------------------
    // SVG Icons
    // -----------------------------------------------------------------------
    var ICONS = {
        clover: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
        chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>',
        close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
        send: '<svg viewBox="0 0 24 24"><path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg>',
        headerClose: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
    };

    // -----------------------------------------------------------------------
    // HTML Template
    // -----------------------------------------------------------------------
    var HTML = '\
    <button id="cb-fab" aria-label="Chat with CloverBot">\
        <div class="cb-pulse"></div>\
        <span class="cb-fab-icon cb-fab-chat">' + ICONS.chat + '</span>\
        <span class="cb-fab-icon cb-fab-close">' + ICONS.close + '</span>\
        <span class="cb-badge">1</span>\
    </button>\
    <div id="cb-window">\
        <div id="cb-header">\
            <div class="cb-avatar">\
                ' + ICONS.clover + '\
                <div class="cb-status-dot"></div>\
            </div>\
            <div class="cb-header-info">\
                <div class="cb-header-name">CloverBot</div>\
                <div class="cb-header-status">Online</div>\
            </div>\
            <button class="cb-header-close" aria-label="Close chat">' + ICONS.headerClose + '</button>\
        </div>\
        <div id="cb-messages">\
            <div id="cb-welcome">\
                <div class="cb-welcome-icon">' + ICONS.clover + '</div>\
                <div class="cb-welcome-title">Hey, I\'m CloverBot</div>\
                <div class="cb-welcome-text">I know MyClover.Tech inside and out -- hardware, cloud, AI, all of it. Ask me anything.</div>\
            </div>\
        </div>\
        <div id="cb-quick-actions">\
            <span class="cb-quick-pill" data-q="What products do you offer?">Products</span>\
            <span class="cb-quick-pill" data-q="Tell me about the Citadel hardware">Hardware</span>\
            <span class="cb-quick-pill" data-q="What are your cloud pricing plans?">Pricing</span>\
            <span class="cb-quick-pill" data-q="How does the private AI agent work?">AI Agent</span>\
        </div>\
        <div id="cb-lead">\
            <div class="cb-lead-title">Quick intro (optional)</div>\
            <input type="text" id="cb-lead-name" placeholder="Your name" autocomplete="name" />\
            <input type="email" id="cb-lead-email" placeholder="Email address" autocomplete="email" />\
            <input type="text" id="cb-lead-company" placeholder="Company" autocomplete="organization" />\
            <button id="cb-lead-submit">Start chatting</button>\
        </div>\
        <div id="cb-input-area">\
            <textarea id="cb-input" rows="1" placeholder="Message CloverBot..."></textarea>\
            <button id="cb-send" aria-label="Send message">' + ICONS.send + '</button>\
        </div>\
        <div id="cb-footer"><a href="https://myclover.tech" target="_blank" rel="noopener">Powered by MyClover.Tech</a></div>\
    </div>\
    ';

    // -----------------------------------------------------------------------
    // Markdown -> HTML (improved)
    // -----------------------------------------------------------------------
    function renderMarkdown(text) {
        if (!text) return "";
        var html = text
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/__(.+?)__/g, "<strong>$1</strong>")
            .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>")
            .replace(/(?<!_)_([^_]+?)_(?!_)/g, "<em>$1</em>")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/^>\s*(.+)/gm, "<blockquote>$1</blockquote>")
            .replace(/^###\s+(.+)/gm, "<h4>$1</h4>")
            .replace(/^##\s+(.+)/gm, "<h3>$1</h3>")
            .replace(/^[-*]\s+(.+)/gm, "<li>$1</li>")
            .replace(/^\d+\.\s+(.+)/gm, "<li>$1</li>")
            .replace(/\n\n/g, "</p><p>")
            .replace(/\n/g, "<br>");

        html = html.replace(/((?:<li>.*?<\/li>(?:<br>)?)+)/g, function (m) {
            return "<ul>" + m.replace(/<br>/g, "") + "</ul>";
        });

        return "<p>" + html + "</p>";
    }

    // -----------------------------------------------------------------------
    // Time formatting
    // -----------------------------------------------------------------------
    function formatTime() {
        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        var ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    function init() {
        var style = document.createElement("style");
        style.textContent = STYLES;
        document.head.appendChild(style);

        var container = document.createElement("div");
        container.id = "cloverbot-widget";
        container.innerHTML = HTML;
        document.body.appendChild(container);

        var fab = document.getElementById("cb-fab");
        var win = document.getElementById("cb-window");
        var messages = document.getElementById("cb-messages");
        var input = document.getElementById("cb-input");
        var sendBtn = document.getElementById("cb-send");
        var leadForm = document.getElementById("cb-lead");
        var leadSubmit = document.getElementById("cb-lead-submit");
        var headerClose = win.querySelector(".cb-header-close");
        var quickActions = document.getElementById("cb-quick-actions");

        function openChat() {
            isOpen = true;
            fab.classList.add("open");
            win.classList.remove("closing");
            win.classList.add("open");

            if (!hasGreeted) {
                hasGreeted = true;
                if (document.body.getAttribute("data-cloverbot-lead") === "true" && !leadCaptured) {
                    leadForm.classList.add("active");
                }
            }
            setTimeout(function () { input.focus(); }, 150);
        }

        function closeChat() {
            isOpen = false;
            fab.classList.remove("open");
            win.classList.add("closing");
            setTimeout(function () {
                win.classList.remove("open", "closing");
            }, 250);
        }

        fab.addEventListener("click", function () {
            if (isOpen) { closeChat(); } else { openChat(); }
        });

        headerClose.addEventListener("click", closeChat);

        // Quick action pills
        quickActions.addEventListener("click", function (e) {
            var pill = e.target.closest(".cb-quick-pill");
            if (!pill) return;
            var q = pill.getAttribute("data-q");
            if (q && !isLoading) {
                quickActions.classList.add("cb-quick-pills-hidden");
                var welcome = document.getElementById("cb-welcome");
                if (welcome) welcome.remove();
                addUserMessage(q);
                sendMessage(q);
            }
        });

        leadSubmit.addEventListener("click", function () {
            var name = document.getElementById("cb-lead-name").value.trim();
            var email = document.getElementById("cb-lead-email").value.trim();
            var company = document.getElementById("cb-lead-company").value.trim();
            if (name || email) { submitLead(name, email, company); }
            leadForm.classList.remove("active");
            leadCaptured = true;
            input.focus();
        });

        function trySend() {
            var text = input.value.trim();
            if (!text || isLoading) return;

            // Hide welcome & quick actions on first real message
            var welcome = document.getElementById("cb-welcome");
            if (welcome) welcome.remove();
            quickActions.classList.add("cb-quick-pills-hidden");

            addUserMessage(text);
            input.value = "";
            input.style.height = "auto";
            sendMessage(text);
        }

        sendBtn.addEventListener("click", trySend);

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                trySend();
            }
        });

        input.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = Math.min(this.scrollHeight, 120) + "px";
        });

        // Escape key to close
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && isOpen) closeChat();
        });
    }

    // -----------------------------------------------------------------------
    // Message rendering
    // -----------------------------------------------------------------------
    function addBotMessage(text) {
        var messages = document.getElementById("cb-messages");
        var grouped = (lastSender === "bot");
        lastSender = "bot";
        messageCount++;

        var row = document.createElement("div");
        row.className = "cb-msg-row bot" + (grouped ? " grouped" : "");
        row.style.animationDelay = "0.05s";

        row.innerHTML = '\
            <div class="cb-msg-avatar">' + ICONS.clover + '</div>\
            <div class="cb-msg-content">\
                <div class="cb-bubble">' + renderMarkdown(text) + '</div>\
                <div class="cb-time">' + formatTime() + '</div>\
            </div>\
        ';

        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
    }

    function addUserMessage(text) {
        var messages = document.getElementById("cb-messages");
        var grouped = (lastSender === "user");
        lastSender = "user";
        messageCount++;

        var row = document.createElement("div");
        row.className = "cb-msg-row user" + (grouped ? " grouped" : "");

        var escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        row.innerHTML = '\
            <div class="cb-msg-avatar">U</div>\
            <div class="cb-msg-content">\
                <div class="cb-bubble">' + escapedText + '</div>\
                <div class="cb-time">' + formatTime() + '</div>\
            </div>\
        ';

        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
        var messages = document.getElementById("cb-messages");
        var row = document.createElement("div");
        row.className = "cb-typing-row";
        row.id = "cb-typing";

        row.innerHTML = '\
            <div class="cb-msg-avatar" style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;flex-shrink:0;align-self:flex-end;margin-bottom:2px">' + ICONS.clover + '</div>\
            <div class="cb-typing-bubble"><span></span><span></span><span></span></div>\
        ';
        row.querySelector(".cb-msg-avatar svg").style.cssText = "width:16px;height:16px;fill:white";

        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        var el = document.getElementById("cb-typing");
        if (el) el.remove();
    }

    // -----------------------------------------------------------------------
    // API calls
    // -----------------------------------------------------------------------
    function sendMessage(text) {
        isLoading = true;
        document.getElementById("cb-send").disabled = true;
        showTyping();

        fetch(API_URL + "/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, session_id: sessionId }),
        })
            .then(function (res) {
                if (!res.ok) {
                    if (res.status === 429) throw new Error("rate_limit");
                    throw new Error("request_failed");
                }
                return res.json();
            })
            .then(function (data) {
                hideTyping();
                sessionId = data.session_id || sessionId;
                addBotMessage(data.reply);

                if (data.escalated) {
                    setTimeout(function () {
                        addBotMessage("I've looped in the MyClover.Tech team -- someone will follow up with you soon.");
                    }, 600);
                }
            })
            .catch(function (err) {
                hideTyping();
                if (err.message === "rate_limit") {
                    addBotMessage("Easy there -- you're sending messages faster than I can think. Give me a sec and try again.");
                } else {
                    addBotMessage("Hmm, I'm having trouble connecting right now. Try again in a moment, or head to **[myclover.tech](https://myclover.tech)** to reach the team directly.");
                }
            })
            .finally(function () {
                isLoading = false;
                document.getElementById("cb-send").disabled = false;
            });
    }

    function submitLead(name, email, company) {
        fetch(API_URL + "/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, name: name, email: email, company: company }),
        }).catch(function () {});
    }

    // -----------------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------------
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
