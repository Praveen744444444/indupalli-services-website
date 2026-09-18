/* ============================================================
   INDUPALLI SERVICES ATS — Chat Module
   Supabase Realtime
   Recruiter ↔ Candidate real-time messaging
   ============================================================ */

import { supabase } from "./supabase.js";

let activeChatChannel = null;


/* ============================================================
   INITIALIZE CHAT ROOM
   ============================================================ */

window.initializeChatRoom = async function (
    appId,
    candidateName,
    senderRole
) {
    const sender =
        senderRole ||
        localStorage.getItem("userRole") ||
        "recruiter";

    /* Remove existing chat modal */
    const existing = document.getElementById("atsChatModal");

    if (existing) {
        existing.remove();
    }

    /* Remove previous realtime channel */
    if (activeChatChannel) {
        try {
            await supabase.removeChannel(activeChatChannel);
        } catch (error) {
            console.warn("Could not remove previous chat channel:", error);
        }

        activeChatChannel = null;
    }


    /* ============================================================
       BUILD CHAT UI
       ============================================================ */

    const modal = document.createElement("div");

    modal.id = "atsChatModal";

    modal.innerHTML = `
        <div style="
            position:fixed;
            bottom:0;
            right:24px;
            width:380px;
            height:520px;
            background:#fff;
            border-radius:16px 16px 0 0;
            box-shadow:0 -4px 30px rgba(0,0,0,.18);
            display:flex;
            flex-direction:column;
            z-index:99999;
            overflow:hidden;
            font-family:'Segoe UI',Calibri,Arial,sans-serif;
        ">

            <!-- HEADER -->
            <div style="
                background:linear-gradient(135deg,#001b5e,#0056d2);
                color:#fff;
                padding:14px 18px;
                display:flex;
                justify-content:space-between;
                align-items:center;
                flex-shrink:0;
            ">

                <div style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                ">

                    <div style="
                        width:36px;
                        height:36px;
                        background:rgba(255,255,255,.2);
                        border-radius:50%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:15px;
                        font-weight:700;
                    ">
                        ${(candidateName || "C")[0].toUpperCase()}
                    </div>

                    <div>
                        <div style="
                            font-size:14px;
                            font-weight:700;
                        " id="chatCandidateHeaderName">
                            ${candidateName || "Candidate"}
                        </div>

                        <div style="
                            font-size:11px;
                            opacity:.75;
                        ">
                            Live Communication Channel
                        </div>
                    </div>

                </div>

                <button
                    type="button"
                    onclick="window.closeChatWindow()"
                    style="
                        background:rgba(255,255,255,.15);
                        border:none;
                        color:#fff;
                        width:28px;
                        height:28px;
                        border-radius:50%;
                        cursor:pointer;
                        font-size:16px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                    "
                    aria-label="Close chat"
                >
                    ✕
                </button>

            </div>


            <!-- MESSAGE STREAM -->
            <div
                id="chatMessageStream"
                style="
                    flex:1;
                    overflow-y:auto;
                    padding:16px;
                    display:flex;
                    flex-direction:column;
                    gap:12px;
                    background:#f5f7ff;
                "
            >
                <div style="
                    text-align:center;
                    color:#94a3b8;
                    font-size:12px;
                    padding:10px;
                ">
                    Loading conversation...
                </div>
            </div>


            <!-- INPUT -->
            <div style="
                padding:12px;
                background:#fff;
                border-top:1px solid #e0e8ff;
                flex-shrink:0;
            ">

                <form
                    id="chatForm"
                    style="
                        display:flex;
                        gap:8px;
                    "
                >

                    <input
                        type="text"
                        id="chatMessageInput"
                        placeholder="Type a professional message..."
                        autocomplete="off"
                        maxlength="2000"
                        style="
                            flex:1;
                            padding:10px 14px;
                            border:2px solid #e0e8ff;
                            border-radius:24px;
                            font-size:14px;
                            outline:none;
                            font-family:inherit;
                        "
                        onfocus="this.style.borderColor='#0056d2'"
                        onblur="this.style.borderColor='#e0e8ff'"
                    >

                    <button
                        type="submit"
                        style="
                            width:40px;
                            height:40px;
                            background:#0056d2;
                            border:none;
                            border-radius:50%;
                            color:#fff;
                            font-size:16px;
                            cursor:pointer;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            flex-shrink:0;
                        "
                        aria-label="Send message"
                    >
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>

                </form>

            </div>

        </div>
    `;

    document.body.appendChild(modal);


    /* ============================================================
       HTML ESCAPE
       ============================================================ */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ============================================================
       RENDER MESSAGES
       ============================================================ */

    async function renderMessages() {

        const stream =
            document.getElementById("chatMessageStream");

        if (!stream) {
            return;
        }

        try {

            const {
                data: msgs,
                error
            } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("application_id", appId)
                .order("created_at", {
                    ascending: true
                });

            if (error) {
                throw error;
            }


            /* No messages */
            if (!msgs || msgs.length === 0) {

                stream.innerHTML = `
                    <div style="
                        text-align:center;
                        color:#94a3b8;
                        font-size:11px;
                        padding:4px 0;
                    ">
                        Conversation initialized. No messages yet.
                    </div>
                `;

                return;
            }


            stream.innerHTML = `
                <div style="
                    text-align:center;
                    color:#94a3b8;
                    font-size:11px;
                    padding:4px 0;
                ">
                    Live message feed synced
                </div>
            `;


            const unreadUpdates = [];


            msgs.forEach((msg) => {

                const isMe =
                    msg.sender === sender;

                const displayName =
                    isMe
                        ? "You"
                        : (
                            msg.candidate_name ||
                            candidateName ||
                            "Candidate"
                        );


                const timeStr =
                    msg.created_at
                        ? new Date(
                            msg.created_at
                        ).toLocaleTimeString(
                            [],
                            {
                                hour: "2-digit",
                                minute: "2-digit"
                            }
                        )
                        : "Just now";


                /* Mark incoming recruiter messages as read */
                if (
                    !isMe &&
                    !msg.read &&
                    sender === "recruiter"
                ) {
                    unreadUpdates.push(msg.id);
                }


                const safeText =
                    escapeHtml(msg.text || "");

                const safeName =
                    escapeHtml(displayName);


                const statusIndicator =
                    isMe
                        ? `
                            <span style="
                                font-size:9.5px;
                                color:${msg.read ? "#10b981" : "#94a3b8"};
                                margin-left:6px;
                            ">
                                ${msg.read ? "✓ Seen" : "• Unread"}
                            </span>
                        `
                        : "";


                stream.innerHTML += `

                    <div style="
                        display:flex;
                        flex-direction:column;
                        align-items:${isMe ? "flex-end" : "flex-start"};
                    ">

                        <div style="
                            font-size:11px;
                            font-weight:600;
                            color:#64748b;
                            margin-bottom:3px;
                            padding:0 4px;
                        ">
                            ${safeName}

                            <span style="
                                font-weight:400;
                                color:#94a3b8;
                                font-size:9.5px;
                            ">
                                ${timeStr}
                            </span>

                            ${statusIndicator}
                        </div>


                        <div style="
                            background:${isMe ? "#0056d2" : "#fff"};
                            color:${isMe ? "#fff" : "#1a1a2e"};
                            padding:10px 14px;
                            border-radius:${isMe
                                ? "18px 18px 4px 18px"
                                : "18px 18px 18px 4px"
                            };
                            font-size:13.5px;
                            max-width:80%;
                            line-height:1.5;
                            box-shadow:0 2px 6px rgba(0,0,0,.07);
                            word-break:break-word;
                            white-space:pre-wrap;
                        ">
                            ${safeText}
                        </div>


                        ${
                            !isMe
                                ? `
                                    <button
                                        type="button"
                                        onclick="window.handleChatReply(
                                            '${safeName}',
                                            '${safeText}'
                                        )"
                                        style="
                                            background:none;
                                            border:none;
                                            color:#0056d2;
                                            font-size:11px;
                                            font-weight:600;
                                            cursor:pointer;
                                            margin-top:3px;
                                            padding:0 4px;
                                            display:inline-flex;
                                            align-items:center;
                                            gap:3px;
                                        "
                                    >
                                        <i
                                            class="fa-solid fa-reply"
                                            style="font-size:9px;"
                                        ></i>

                                        Reply
                                    </button>
                                `
                                : ""
                        }

                    </div>
                `;
            });


            stream.scrollTop =
                stream.scrollHeight;


            /* Mark messages as seen */
            if (
                unreadUpdates.length > 0 &&
                sender === "recruiter"
            ) {

                for (const msgId of unreadUpdates) {

                    const {
                        error: readError
                    } = await supabase
                        .from("chat_messages")
                        .update({
                            read: true
                        })
                        .eq("id", msgId);

                    if (readError) {
                        console.warn(
                            "Could not mark message as read:",
                            readError
                        );
                    }
                }
            }

        } catch (error) {

            console.error(
                "Error fetching chat messages:",
                error
            );

            stream.innerHTML = `
                <div style="
                    text-align:center;
                    color:#b91c1c;
                    font-size:12px;
                    padding:20px;
                ">
                    Unable to load messages.
                </div>
            `;
        }
    }


    /* ============================================================
       INITIAL LOAD
       ============================================================ */

    await renderMessages();


    /* ============================================================
       SUPABASE REALTIME
       ============================================================ */

    activeChatChannel = supabase
        .channel(
            `chat_messages_application_${appId}`
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_messages",
                filter: `application_id=eq.${appId}`
            },
            () => {
                renderMessages();
            }
        )
        .subscribe((status) => {

            console.log(
                `Chat realtime status for application ${appId}:`,
                status
            );

        });


    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    const chatForm =
        document.getElementById("chatForm");

    if (!chatForm) {
        return;
    }


    chatForm.onsubmit = async (event) => {

        event.preventDefault();


        const input =
            document.getElementById(
                "chatMessageInput"
            );

        if (!input) {
            return;
        }


        const text =
            input.value.trim();


        if (!text) {
            return;
        }


        input.value = "";


        try {

            /* Insert chat message */
            const {
                error: msgErr
            } = await supabase
                .from("chat_messages")
                .insert([
                    {
                        application_id: appId,
                        text: text,
                        sender: sender,
                        candidate_name:
                            candidateName || "Candidate",
                        sender_label:
                            sender === "recruiter"
                                ? "Recruiter"
                                : (
                                    candidateName ||
                                    "Candidate"
                                ),
                        read: false
                    }
                ]);


            if (msgErr) {
                throw msgErr;
            }


            /* Create notification */
            const {
                error: notificationError
            } = await supabase
                .from("notifications")
                .insert([
                    {
                        application_id: appId,
                        sender: sender,
                        candidate_name:
                            candidateName || "Candidate",
                        message:
                            `${candidateName || "Candidate"}: "${text}"`,
                        is_read: false
                    }
                ]);


            if (notificationError) {

                console.warn(
                    "Chat message sent, but notification failed:",
                    notificationError
                );
            }


        } catch (error) {

            console.error(
                "Chat send error:",
                error
            );

            input.value = text;

            if (typeof window.showCustomAlert === "function") {

                window.showCustomAlert(
                    error?.message ||
                    "Unable to send the message. Please try again.",
                    "Message Failed",
                    "Error"
                );

            } else {

                alert(
                    "Unable to send the message. Please try again."
                );
            }
        }
    };
};


/* ============================================================
   REPLY
   ============================================================ */

window.handleChatReply = function (
    name,
    text
) {

    const input =
        document.getElementById(
            "chatMessageInput"
        );

    if (!input) {
        return;
    }


    const cleanText =
        String(text || "")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, "&");


    input.value =
        `Replying to ${name}: "${cleanText.substring(0, 30)}${
            cleanText.length > 30 ? "..." : ""
        }"\n\n`;

    input.focus();
};


/* ============================================================
   CLOSE CHAT
   ============================================================ */

window.closeChatWindow = async function () {

    const modal =
        document.getElementById(
            "atsChatModal"
        );

    if (modal) {
        modal.remove();
    }


    if (activeChatChannel) {

        try {

            await supabase.removeChannel(
                activeChatChannel
            );

        } catch (error) {

            console.warn(
                "Could not remove chat channel:",
                error
            );
        }

        activeChatChannel = null;
    }
};


/* ============================================================
   DEBUG
   ============================================================ */

console.log(
    "✅ Indupalli ATS Chat Module Loaded — Supabase Realtime"
);
