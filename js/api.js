// ==================== API.JS ====================
var API = {
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://cafi-api-90dac8d1c99f.herokuapp.com/api',
    
    token: localStorage.getItem('token'),
    usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),
    
    request: function(endpoint, method, data) {
        var self = this;
        method = method || 'GET';
        
        var options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (self.token) {
            options.headers['Authorization'] = 'Bearer ' + self.token;
        }
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        var url = self.baseURL + endpoint;
        
        return fetch(url, options)
            .then(function(response) {
                if (response.status === 401) {
                    self.logout();
                    throw new Error('Sesión expirada');
                }
                return response.json();
            });
    },
    
    login: function(usuario, password, sucursalId) {
        var self = this;
        return this.request('/auth/login', 'POST', {
            usuario: usuario,
            password: password,
            sucursal_id: sucursalId
        }).then(function(r) {
            if (r.success && r.token) {
                self.token = r.token;
                self.usuario = r.usuario;
                localStorage.setItem('token', r.token);
                localStorage.setItem('usuario', JSON.stringify(r.usuario));
            }
            return r;
        });
    },
    
    logout: function() {
        this.token = null;
        this.usuario = null;
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '../index.html';
    },
    
    isLoggedIn: function() {
        return !!(this.token && this.usuario);
    }
};
