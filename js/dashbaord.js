// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("currentUser");

  if (role === "headmaster") {
    loadLinkDropdowns(); // 🔥 THIS LINE IS REQUIRED
  }

  if (!role || !username) {
    window.location.href = "index.html";
    return;
  }

  // Welcome
  const welcome = document.getElementById("welcome");
  if (welcome) {
    welcome.innerText = `👋 Welcome ${username} (${role})`;
  }

  // Hide all role sections
  document.querySelectorAll(".role-section").forEach(div => {
    div.style.display = "none";
  });

  const roleMap = {
    teacher: "teacherSection",
    student: "studentSection",
    parent: "parentSection",
    headmaster: "headmasterSection"
  };

  const section = document.getElementById(roleMap[role]);
  if (section) section.style.display = "block";

  // Load report system (safe)
  if (typeof loadReportDropdowns === "function") {
    loadReportDropdowns();
  }
  if (typeof displayReports === "function") {
    displayReports();
  }
  const select = document.getElementById("userSelect");
  if (select) {
    select.addEventListener("change", () => {
      displayMessages();
    });
  }

  // Chat init
  loadUsers();
  setupRealtime();
});


// ================= NAV =================
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(sec => {
    sec.style.display = "none";
  });

  const active = document.getElementById(sectionId);
  if (active) active.style.display = "block";
}


// ================= LOGOUT =================
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}


// ================= LOAD USERS =================
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

    // 👑 headmaster → can chat with anyone
    if (role === "headmaster") {
      const opt = document.createElement("option");
      opt.value = user.username;
      opt.textContent = user.username;
      select.appendChild(opt);
    }

    // 👨‍🏫👨‍🎓👨‍👩‍👧 → only headmaster
    if (role !== "headmaster" && user.role === "headmaster") {
      const opt = document.createElement("option");
      opt.value = user.username;
      opt.textContent = user.username;
      select.appendChild(opt);
    }
  });

  // 🔥 AUTO SELECT FIRST USER (CRITICAL)
  if (select.options.length > 0) {
    select.selectedIndex = 0;

    // 👇 WAIT a bit then load messages
    setTimeout(() => {
      displayMessages();
    }, 200);
  }
}
// ================= DISPLAY MESSAGES =================
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
    const div = document.createElement("div");

    const isMe = msg.from_user === currentUser;

    div.style.display = "flex";
    div.style.justifyContent = isMe ? "flex-end" : "flex-start";
    div.style.margin = "5px 0";

    const bubble = document.createElement("div");

    bubble.style.maxWidth = "60%";
    bubble.style.padding = "10px";
    bubble.style.borderRadius = "15px";
    bubble.style.fontSize = "14px";
    bubble.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    bubble.style.background = isMe ? "#4CAF50" : "#eee";
    bubble.style.color = isMe ? "white" : "black";

    bubble.innerHTML = `
    <div>${msg.message}</div>
    <div style="font-size:10px; text-align:right; margin-top:5px;">
      ${new Date(msg.created_at).toLocaleTimeString()}
    </div>
  `;

    div.appendChild(bubble);
    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}


// ================= SEND MESSAGE =================
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  const toUser = document.getElementById("userSelect")?.value;
  const fromUser = localStorage.getItem("currentUser");

  if (!message || !toUser) return;

  const { error } = await supabaseClient.from("messages").insert([{
    from_user: fromUser,
    to_user: toUser,
    message: message
  }]);

  if (error) {
    console.log(error);
    alert("送信エラー");
    return;
  }

  input.value = "";
}


// ================= REALTIME =================
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
      (payload) => {   // ✅ payload exists ONLY here

        console.log("New message:", payload.new); // ✅ SAFE HERE

        const currentUser = localStorage.getItem("currentUser");
        const selectedUser = document.getElementById("userSelect")?.value;
        const msg = payload.new;

        // 🔄 update chat if open
        if (
          (msg.from_user === currentUser && msg.to_user === selectedUser) ||
          (msg.from_user === selectedUser && msg.to_user === currentUser)
        ) {
          displayMessages();
        }

        // 🔔 notification
        if (msg.to_user === currentUser) {
          showNotification(msg.from_user, msg.message);
        }
      }
    )
    .subscribe();
}


// ================= NOTIFICATION =================
// ================= NOTIFICATION =================
function showNotification(from, message) {

  // ❌ prevent multiple stacking spam
  const existing = document.getElementById("chatNotif");
  if (existing) existing.remove();

  const notif = document.createElement("div");
  notif.id = "chatNotif";

  notif.style.position = "fixed";
  notif.style.top = "20px";
  notif.style.right = "20px";
  notif.style.background = "linear-gradient(135deg, #2c3e50, #4ca1af)";
  notif.style.color = "white";
  notif.style.padding = "12px 16px";
  notif.style.borderRadius = "12px";
  notif.style.zIndex = "9999";
  notif.style.boxShadow = "0 6px 15px rgba(0,0,0,0.3)";
  notif.style.fontSize = "14px";
  notif.style.animation = "fadeIn 0.3s ease";

  notif.innerHTML = `
    <strong>💬 ${from}</strong><br>
    <span>${message}</span>
  `;

  document.body.appendChild(notif);

  // 🔊 sound (optional but nice)
  try {
    new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3").play();
  } catch (e) { }

  setTimeout(() => {
    notif.style.opacity = "0";
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}
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

  if (!studentSelect || !parentSelect) {
    console.log("Dropdown not found");
    return;
  }

  studentSelect.innerHTML = '<option value="">生徒を選択</option>';
  parentSelect.innerHTML = '<option value="">保護者を選択</option>';

  users.forEach(user => {
    if (user.role === "student") {
      const opt = document.createElement("option");
      opt.value = user.id; // ✅ IMPORTANT
      opt.textContent = user.username;
      studentSelect.appendChild(opt);
    }

    if (user.role === "parent") {
      const opt = document.createElement("option");
      opt.value = user.id; // ✅ IMPORTANT
      opt.textContent = user.username;
      parentSelect.appendChild(opt);
    }
  });
}
// 🔔 notification
if (msg.to_user?.toLowerCase() === currentUser?.toLowerCase()) {
  showNotification(msg.from_user, msg.message);
}
// ================= LINK PARENT =================
async function linkParent() {
  const studentId = document.getElementById("linkStudent").value;
  const parentId = document.getElementById("linkParent").value;

  console.log("Student ID:", studentId);
  console.log("Parent ID:", parentId);

  if (!studentId || !parentId) {
    alert("選択してください");
    return;
  }

  const { error } = await supabaseClient
    .from("users")
    .update({ parent_id: parentId })
    .eq("id", studentId);

  if (error) {
    console.log("ERROR:", error);
    alert("リンク失敗");
    return;
  }

  alert("リンク成功！");
}