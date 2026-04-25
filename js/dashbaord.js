// ======================================================
// CONFIG
// ======================================================
const RESTRICTED_HEADMASTER = "Tanaka塾長";


// ======================================================
// INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {

  const role = localStorage.getItem("role");
  const username = localStorage.getItem("currentUser");

  if (!role || !username) {
    window.location.href = "index.html";
    return;
  }

  // Welcome label
  const welcome = document.getElementById("welcome");
  if (welcome) {
    welcome.innerText = `👋 Welcome ${username} (${role})`;
  }

  // Hide all role sections
  document.querySelectorAll(".role-section").forEach(div => {
    div.style.display = "none";
  });

  // Show correct section
  const roleMap = {
    teacher: "teacherSection",
    student: "studentSection",
    parent: "parentSection",
    headmaster: "headmasterSection"
  };

  const section = document.getElementById(roleMap[role]);
  if (section) section.style.display = "block";

  // Headmaster UI
  if (role === "headmaster") {
    loadLinkDropdowns();
  }

  // Reports
  if (typeof loadReportDropdowns === "function") loadReportDropdowns();
  if (typeof displayReports === "function") displayReports();

  // Chat user selection
  const select = document.getElementById("userSelect");
  if (select) {
    select.addEventListener("change", () => displayMessages());
  }

  loadUsers();
  setupRealtime();
});


// ======================================================
// NAVIGATION
// ======================================================
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(sec => {
    sec.style.display = "none";
  });

  const active = document.getElementById(sectionId);
  if (active) active.style.display = "block";
}


// ======================================================
// LOGOUT
// ======================================================
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}


// ======================================================
// LOAD CHAT USERS
// ======================================================
async function loadUsers() {

  const select = document.getElementById("userSelect");
  if (!select) return;

  const currentUser = localStorage.getItem("currentUser");
  const role = localStorage.getItem("role");

  const { data: users, error } = await supabaseClient
    .from("users")
    .select("*");

  if (error) {
    console.log(error);
    return;
  }

  select.innerHTML = "";

  users.forEach(user => {

    if (user.username === currentUser) return;

    // STUDENT
    if (role === "student") {
      if (user.role === "headmaster" && user.username !== RESTRICTED_HEADMASTER) {
        addChatOption(user);
      }
      return;
    }

    // TEACHER / PARENT
    if (role === "teacher" || role === "parent") {
      if (user.role === "headmaster") addChatOption(user);
      return;
    }

    // HEADMASTER
    if (role === "headmaster") {

      // Tanaka cannot see students
      if (currentUser === RESTRICTED_HEADMASTER && user.role === "student") {
        return;
      }

      addChatOption(user);
    }
  });

  if (select.options.length > 0) {
    select.selectedIndex = 0;
    setTimeout(() => displayMessages(), 200);
  }
}

function addChatOption(user) {
  const select = document.getElementById("userSelect");
  const opt = document.createElement("option");
  opt.value = user.username;
  opt.textContent = user.username;
  select.appendChild(opt);
}


// ======================================================
// DISPLAY MESSAGES
// ======================================================
async function displayMessages() {

  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  chatBox.innerHTML = "";

  const currentUser = localStorage.getItem("currentUser");
  const selectedUser = document.getElementById("userSelect")?.value;

  if (!selectedUser) return;

  const { data: messages, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(
      `and(from_user.eq.${currentUser},to_user.eq.${selectedUser}),and(from_user.eq.${selectedUser},to_user.eq.${currentUser})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  messages.forEach(msg => {
    const row = document.createElement("div");
    const isMe = msg.from_user === currentUser;

    row.style.display = "flex";
    row.style.justifyContent = isMe ? "flex-end" : "flex-start";
    row.style.margin = "8px 0";

    const bubble = document.createElement("div");
    bubble.style.maxWidth = "65%";
    bubble.style.padding = "10px 14px";
    bubble.style.borderRadius = "18px";
    bubble.style.boxShadow = "0 2px 6px rgba(0,0,0,.15)";
    bubble.style.background = isMe ? "#4CAF50" : "#eee";
    bubble.style.color = isMe ? "white" : "black";

    bubble.innerHTML = `
      <div>${msg.message}</div>
      <div style="font-size:10px;text-align:right;margin-top:5px;">
        ${msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ""}
      </div>
    `;

    row.appendChild(bubble);
    chatBox.appendChild(row);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}


// ======================================================
// SEND MESSAGE
// ======================================================
async function sendMessage() {

  const input = document.getElementById("messageInput");
  const message = input.value.trim();

  const fromUser = localStorage.getItem("currentUser");
  const role = localStorage.getItem("role");
  const toUser = document.getElementById("userSelect")?.value;

  if (!message || !toUser) return;

  // Student cannot chat Tanaka
  if (role === "student" && toUser === RESTRICTED_HEADMASTER) {
    alert("この塾長には送信できません");
    return;
  }

  // Tanaka cannot send to students
  if (fromUser === RESTRICTED_HEADMASTER) {

    const { data: user } = await supabaseClient
      .from("users")
      .select("role")
      .eq("username", toUser)
      .single();

    if (user?.role === "student") {
      alert("学生とのチャットは禁止されています");
      return;
    }
  }

  const { error } = await supabaseClient
    .from("messages")
    .insert([
      {
        from_user: fromUser,
        to_user: toUser,
        message: message
      }
    ]);

  if (error) {
    console.log(error);
    alert("送信エラー");
    return;
  }

  input.value = "";
}


// ======================================================
// REALTIME
// ======================================================
function setupRealtime() {

  console.log("Realtime connected...");

  supabaseClient
    .channel("chat")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      payload => {

        const currentUser = localStorage.getItem("currentUser");
        const selectedUser = document.getElementById("userSelect")?.value;

        const msg = payload.new;

        if (
          (msg.from_user === currentUser && msg.to_user === selectedUser) ||
          (msg.from_user === selectedUser && msg.to_user === currentUser)
        ) {
          displayMessages();
        }

        if (msg.to_user === currentUser) {
          showNotification(msg.from_user, msg.message);
        }
      }
    )
    .subscribe();
}


// ======================================================
// NOTIFICATION
// ======================================================
function showNotification(from, message) {

  const existing = document.getElementById("chatNotif");
  if (existing) existing.remove();

  const notif = document.createElement("div");
  notif.id = "chatNotif";

  notif.style.position = "fixed";
  notif.style.top = "20px";
  notif.style.right = "20px";
  notif.style.background = "linear-gradient(135deg,#2c3e50,#4ca1af)";
  notif.style.color = "white";
  notif.style.padding = "12px 16px";
  notif.style.borderRadius = "12px";
  notif.style.zIndex = "9999";
  notif.style.boxShadow = "0 6px 15px rgba(0,0,0,.3)";

  notif.innerHTML = `
    <strong>💬 ${from}</strong><br>
    ${message}
  `;

  document.body.appendChild(notif);

  setTimeout(() => notif.remove(), 3000);
}


// ======================================================
// HEADMASTER: LOAD LINK DROPDOWNS
// ======================================================
async function loadLinkDropdowns() {

  const { data: users, error } = await supabaseClient
    .from("users")
    .select("*");

  if (error) {
    console.log(error);
    return;
  }

  const studentSelect = document.getElementById("linkStudent");
  const parentSelect = document.getElementById("linkParent");

  if (!studentSelect || !parentSelect) return;

  studentSelect.innerHTML = '<option value="">生徒を選択</option>';
  parentSelect.innerHTML = '<option value="">保護者を選択</option>';

  users.forEach(user => {

    if (user.role === "student") {
      const opt = document.createElement("option");
      opt.value = user.id;
      opt.textContent = user.username;
      studentSelect.appendChild(opt);
    }

    if (user.role === "parent") {
      const opt = document.createElement("option");
      opt.value = user.id;
      opt.textContent = user.username;
      parentSelect.appendChild(opt);
    }
  });
}


// ======================================================
// HEADMASTER: LINK PARENT
// ======================================================
async function linkParent() {

  const studentId = document.getElementById("linkStudent").value;
  const parentId = document.getElementById("linkParent").value;

  if (!studentId || !parentId) {
    alert("生徒と保護者を選択してください");
    return;
  }

  const { data: parentData, error: parentError } = await supabaseClient
    .from("users")
    .select("username")
    .eq("id", parentId)
    .single();

  if (parentError) {
    console.log(parentError);
    alert("親の取得エラー");
    return;
  }

  const parentUsername = parentData.username;

  const { error } = await supabaseClient
    .from("users")
    .update({ parent_username: parentUsername })
    .eq("id", studentId);

  if (error) {
    console.log(error);
    alert("リンク失敗");
    return;
  }

  alert("リンク成功！");
}
