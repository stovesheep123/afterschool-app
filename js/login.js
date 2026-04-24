async function login() {
  let username = document.getElementById("username").value.trim();
  let password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Enter username and password");
    return;
  }

  let { data: user, error } = await supabaseClient
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !user) {
    alert("Invalid login");
    return;
  }

  localStorage.setItem("role", user.role);
  localStorage.setItem("currentUser", user.username);

  window.location.href = "dashboard.html";
}