async function register() {
  let username = document.getElementById("username").value.trim();
  let password = document.getElementById("password").value.trim();
  let role = document.getElementById("role").value;

  if (!username || !password || !role) {
    alert("Fill all fields");
    return;
  }

  // check if user exists
  let { data: existing, error: checkError } = await supabaseClient
    .from("users")
    .select("*")
    .eq("username", username);

  if (existing && existing.length > 0) {
    alert("Username already exists");
    return;
  }

  // insert user
  let { error } = await supabaseClient.from("users").insert([{
    username,
    password,
    role
  }]);

  if (error) {
    console.log(error);
    alert("Error registering");
    return;
  }

  alert("Registered successfully!");
  window.location.href = "index.html";
}