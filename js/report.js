// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  loadReportDropdowns();
  displayReports();
  applyReportPermissions();
});

function applyReportPermissions() {
  const role = localStorage.getItem("role");

  const form = document.getElementById("reportForm");
  if (!form) return;

  if (role === "student" || role === "parent") {
    form.style.display = "none";
  }
}
// ================= DROPDOWNS =================
async function loadReportDropdowns() {
  const teacherSelect = document.getElementById("teacher_name");
  const studentSelect = document.getElementById("student_name");

  if (!teacherSelect || !studentSelect) return;

  const { data: users, error } = await supabaseClient
    .from("users")
    .select("*");

  if (error) {
    console.log(error);
    return;
  }

  teacherSelect.innerHTML = '<option value="">担当講師</option>';
  studentSelect.innerHTML = '<option value="">生徒氏名</option>';

  users.forEach(user => {
    // 👇 teachers + headmaster can appear
    if (user.role === "teacher" || user.role === "headmaster") {
      const opt = document.createElement("option");
      opt.value = user.id
      opt.textContent = user.username;
      teacherSelect.appendChild(opt);
    }

    if (user.role === "student") {
      const opt = document.createElement("option");
      opt.value = user.username;
      opt.textContent = user.username;
      studentSelect.appendChild(opt);
    }
  });
}

// ================= SAVE =================
async function saveReport() {
  const role = localStorage.getItem("role");

  // 🔒 block in frontend
  if (role !== "teacher" && role !== "headmaster") {
    alert("❌ 権限がありません");
    return;
  }

  const teacher_name = document.getElementById("teacher_name").value;
  const student_name = document.getElementById("student_name").value;
  const subject = document.getElementById("subject").value;
  const date = document.getElementById("date").value;
  const understanding = document.getElementById("understanding").value;
  const content = document.getElementById("content").value;
  const homework = document.getElementById("homework").value;

  let { error } = await supabaseClient.from("reports").insert([{
    teacher_name,
    student_name,
    subject,
    date,
    understanding,
    content,
    homework,
    created_by_role: role, // 🔥 IMPORTANT
    status: "pending"
  }]);

  if (error) {
    console.log(error);
    alert("保存エラー");
    return;
  }

  alert("保存成功！");
  displayReports(); // 🔥 add this after success
}


// ================= DISPLAY =================
async function displayReports() {
  const list = document.getElementById("reportList");
  if (!list) return;

  list.innerHTML = "";

  const role = localStorage.getItem("role");
  const currentUser = localStorage.getItem("currentUser");

  // 🔥 get reports
  const { data: reports, error } = await supabaseClient
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log(error);
    return;
  }

  // 🔥 get users (for parent linking)
  const { data: users } = await supabaseClient
    .from("users")
    .select("*");

  let filtered = [];

  if (role === "headmaster") {
    filtered = reports;
  }

  if (role === "teacher") {
    filtered = reports.filter(r => r.teacher_name === currentUser);
  }

  if (role === "student") {
    filtered = reports.filter(r =>
      r.student_name === currentUser && r.status === "approved"
    );
  }

  if (role === "parent") {

    // 👇 find all children of this parent
    const children = users
      .filter(u => u.parent_username === currentUser)
      .map(u => u.username);

    console.log("👨‍👩‍👧 Children:", children);

    filtered = reports.filter(r =>
      children.includes(r.student_name) &&
      r.status === "approved"
    );
  }

  // 🔥 DISPLAY
  filtered.forEach(r => {
    const div = document.createElement("div");

    div.style.background = "white";
    div.style.borderRadius = "15px";
    div.style.padding = "15px";
    div.style.marginBottom = "15px";
    div.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
    div.style.position = "relative";

    const stars = "⭐".repeat(r.understanding);

    const stamp = r.status === "approved"
      ? `<div style="
        position:absolute;
        top:10px;
        right:10px;
        color:red;
        font-size:18px;
        font-weight:bold;
        border:3px solid red;
        padding:6px;
        border-radius:50%;
        transform: rotate(-15deg);
     ">承認</div>`
      : `<div style="
        position:absolute;
        top:10px;
        right:10px;
        color:orange;
        font-size:14px;
     ">⏳ 承認待ち</div>`;

    div.innerHTML = `
  ${stamp}

  <h3 style="margin:0; color:#2c3e50;">
    📘 ${r.subject}
  </h3>

  <p style="margin:5px 0; color:gray;">
    👨‍🏫 ${r.teacher_name} ｜ 👨‍🎓 ${r.student_name}
  </p>

  <p style="margin:5px 0;">
    📅 ${r.date}
  </p>

  <hr>

  <p><b>📖 今日やったこと</b><br>${r.content}</p>

  <p><b>📝 宿題</b><br>${r.homework}</p>

  <p><b>理解度:</b> ${stars} (${r.understanding}/10)</p>

  ${r.approved_by
        ? `<p style="font-size:12px; color:gray;">
           ✔ 承認者: ${r.approved_by}
         </p>`
        : ""
      }
`;

    // headmaster approve button
    if (role === "headmaster" && r.status === "pending") {
      const btn = document.createElement("button");
      btn.innerText = "承認";
      btn.onclick = () => approveReport(r.id, r.student_name);
      div.appendChild(btn);
    }

    list.appendChild(div);
  });
}


// ================= APPROVE =================
async function approveReport(id, student_name) {
  const approver = localStorage.getItem("currentUser");

  // ✅ 1. update report
  const { error } = await supabaseClient
    .from("reports")
    .update({
      status: "approved",
      approved_by: approver,
      approved_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.log(error);
    alert("承認エラー");
    return;
  }

  // ✅ 2. find student → parent
  const { data: users } = await supabaseClient
    .from("users")
    .select("*");

  const student = users.find(u => u.username === student_name);

  if (student && student.parent_username) {
    // ✅ 3. send notification message
    await supabaseClient.from("messages").insert([{
      from_user: approver,
      to_user: student.parent_username,
      student_id: student.id,
      message: `📄 ${student_name}のレポートが承認されました`
    }]);
  }

  displayReports();
}