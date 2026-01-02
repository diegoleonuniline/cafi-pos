const API = {
    token: localStorage.getItem('token'),
    usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),
    
    async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
        return response.json();
    },
    
    async login(email, password) {
        const result = await this.request('/auth/login', 'POST', { email, password });
        if (result.success) {
            this.token = result.token;
            this.usuario = result.usuario;
            localStorage.setItem('token', result.token);
            localStorage.setItem('usuario', JSON.stringify(result.usuario));
        }
        return result;
    },
    
    logout() {
        this.token = null;
        this.usuario = null;
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = 'index.html';
    },
    
    isLoggedIn() {
        return !!this.token && !!this.usuario;
    },
    
    // Catálogos
    getCategorias() {
        return this.request(`/categorias/${this.usuario.empresa_id}`);
    },
    
    getProductos() {
        return this.request(`/productos/${this.usuario.empresa_id}`);
    },
    
    getClientes() {
        return this.request(`/clientes/${this.usuario.empresa_id}`);
    },
    
    getMetodosPago() {
        return this.request(`/metodos-pago/${this.usuario.empresa_id}`);
    },
    
    // POS
    cargarPOS() {
        return this.request(`/pos/cargar/${this.usuario.empresa_id}/${this.usuario.sucursal_id}`);
    }
};
