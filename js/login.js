document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');
    const mensaje = document.getElementById('mensaje');
    
    btn.disabled = true;
    btn.textContent = 'Ingresando...';
    mensaje.className = 'mensaje';
    mensaje.style.display = 'none';
    
    try {
        const result = await API.login(email, password);
        
        if (result.success) {
            mensaje.className = 'mensaje success';
            mensaje.textContent = '¡Bienvenido! Redirigiendo...';
            mensaje.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = 'pages/pos.html';
            }, 1000);
        } else {
            mensaje.className = 'mensaje error';
            mensaje.textContent = result.error || 'Error al iniciar sesión';
            mensaje.style.display = 'block';
        }
    } catch (error) {
        mensaje.className = 'mensaje error';
        mensaje.textContent = 'Error de conexión';
        mensaje.style.display = 'block';
    }
    
    btn.disabled = false;
    btn.textContent = 'Ingresar';
});

// Verificar si ya está logueado
if (API.isLoggedIn()) {
    window.location.href = 'pages/pos.html';
}
