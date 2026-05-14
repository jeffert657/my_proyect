class Simulation {
    constructor() {
        // Configuration
        this.TOTAL_HOURS = 12;
        this.START_HOUR = 8; // Start at 8:00 AM
        this.MINUTES_PER_HOUR = 60;
        this.TOTAL_MINUTES = this.TOTAL_HOURS * this.MINUTES_PER_HOUR;
        
        // State
        this.currentTime = 0; // in minutes
        this.isRunning = false;
        this.speed = 10; // Multiplier
        this.clientsInQueue = [];
        this.clientsServed = 0;
        this.isAtmBusy = false;
        this.currentClient = null;
        this.nextArrivalTime = 0;
        this.serviceEndTime = -1;
        this.clientIdCounter = 1;
        // Manual arrival controls
        this.manualArrivalEnabled = false;
        this.manualArrivalMs = 1500; // default 1.5 seconds
        this.manualArrivalHandle = null;

        // DOM Elements
        this.clockDisplay = document.getElementById('clock-display');
        this.queueCountDisplay = document.getElementById('queue-count');
        this.servedCountDisplay = document.getElementById('served-count');
        this.atmStatusDisplay = document.getElementById('atm-status');
        this.queueVisual = document.getElementById('queue-visual');
        this.serverVisual = document.getElementById('server-visual');
        this.arrivalManualCheckbox = document.getElementById('arrival-manual');
        this.arrivalIntervalInput = document.getElementById('arrival-interval');
        this.arrivalUnitsSelect = document.getElementById('arrival-units');
        this.nextArrivalDisplay = document.getElementById('next-arrival-display');
        
        // Bindings
        this.loop = this.loop.bind(this);
        
        this.init();
    }

    init() {
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());
        document.getElementById('speed-range').addEventListener('input', (e) => {
            this.speed = parseInt(e.target.value);
        });
        // Arrival manual controls
        this.arrivalManualCheckbox.addEventListener('change', (e) => {
            this.manualArrivalEnabled = e.target.checked;
            if (this.manualArrivalEnabled) {
                this.startManualArrival();
            } else {
                this.stopManualArrival();
            }
            this.updateNextArrivalUI();
        });
        this.arrivalIntervalInput.addEventListener('input', () => {
            this.updateManualArrivalMsFromUI();
            this.updateNextArrivalUI();
            if (this.manualArrivalEnabled) this.restartManualArrivalIfRunning();
        });
        this.arrivalUnitsSelect.addEventListener('input', () => {
            this.updateManualArrivalMsFromUI();
            this.updateNextArrivalUI();
            if (this.manualArrivalEnabled) this.restartManualArrivalIfRunning();
        });
        
        this.reset();
    }

    reset() {
        this.isRunning = false;
        this.currentTime = 0;
        this.clientsInQueue = [];
        this.clientsServed = 0;
        this.isAtmBusy = false;
        this.currentClient = null;
        this.clientIdCounter = 1;
        this.nextArrivalTime = this.generateNextArrival();
        this.manualArrivalMs = this.convertToMs(parseFloat(this.arrivalIntervalInput.value), this.arrivalUnitsSelect.value);
        this.manualArrivalEnabled = this.arrivalManualCheckbox.checked;
        this.stopManualArrival();
        this.serviceEndTime = -1;
        
        this.updateUI();
        this.renderQueue();
        this.renderServer();
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            if (this.manualArrivalEnabled) this.startManualArrival();
            requestAnimationFrame(this.loop);
        }
    }

    stop() {
        this.isRunning = false;
        // Stop interval polling to conserve resources while paused
        this.stopManualArrival();
    }

    // Generate random arrival time (Poisson-like logic simplified)
    generateNextArrival() {
        // Random time between 1 and 10 minutes from now
        const interval = Math.floor(Math.random() * 10) + 1;
        return this.currentTime + interval;
    }

    // Generate random service time
    generateServiceTime() {
        // Random time between 2 and 8 minutes
        return Math.floor(Math.random() * 6) + 2;
    }

    loop() {
        if (!this.isRunning) return;

        // Advance time
        // The speed determines how many "virtual minutes" pass per frame or tick
        // For smooth animation, we might want to decouple logic tick from render tick
        // But for simplicity, we'll increment a fraction of a minute based on speed
        
        const timeStep = this.speed * 0.05; // Adjustable step
        this.currentTime += timeStep;

        if (this.currentTime >= this.TOTAL_MINUTES) {
            this.currentTime = this.TOTAL_MINUTES;
            this.stop();
            alert('Simulación de 12 horas completada.');
        }

        this.checkEvents();
        this.updateUI();

        if (this.isRunning) {
            requestAnimationFrame(this.loop);
        }
    }

    checkEvents() {
        // 1. Arrival Event (random if manual disabled; manual arrivals triggered by setInterval)
        if (!this.manualArrivalEnabled) {
            if (this.currentTime >= this.nextArrivalTime) {
                this.createClient();
                this.nextArrivalTime = this.generateNextArrival();
            }
        }

        // 2. Service Completion Event
        if (this.isAtmBusy && this.currentTime >= this.serviceEndTime) {
            this.completeService();
        }

        // 3. Start Service Event (if ATM is free and Queue has clients)
        if (!this.isAtmBusy && this.clientsInQueue.length > 0) {
            this.startService();
        }
    }

    // Manual arrival helpers
    convertToMs(value, unit) {
        // value is numeric
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            default: return value * 1000;
        }
    }

    updateManualArrivalMsFromUI() {
        const val = parseFloat(this.arrivalIntervalInput.value);
        const unit = this.arrivalUnitsSelect.value;
        if (!isNaN(val) && val > 0) {
            this.manualArrivalMs = this.convertToMs(val, unit);
        }
    }

    startManualArrival() {
        if (this.manualArrivalHandle) clearInterval(this.manualArrivalHandle);
        if (!this.manualArrivalMs || this.manualArrivalMs <= 0) this.updateManualArrivalMsFromUI();
        // Use setInterval to trigger createClient at the specified real-time interval
        this.manualArrivalHandle = setInterval(() => {
            // only create when simulation is running
            if (this.isRunning) this.createClient();
            // update UI to show next arrival time
            this.updateNextArrivalUI();
        }, Math.max(10, Math.round(this.manualArrivalMs)));
        this.updateNextArrivalUI();
    }

    stopManualArrival() {
        if (this.manualArrivalHandle) {
            clearInterval(this.manualArrivalHandle);
            this.manualArrivalHandle = null;
        }
        this.updateNextArrivalUI();
    }

    restartManualArrivalIfRunning() {
        if (this.manualArrivalEnabled && this.isRunning) {
            this.startManualArrival();
        }
    }

    updateNextArrivalUI() {
        if (this.manualArrivalEnabled) {
            let ms = this.manualArrivalMs || this.convertToMs(parseFloat(this.arrivalIntervalInput.value), this.arrivalUnitsSelect.value);
            // show next arrival in a friendly format using selected unit
            const val = parseFloat(this.arrivalIntervalInput.value);
            const unit = this.arrivalUnitsSelect.value;
            let label = '';
            if (unit === 's') label = `${val} seg(s)`;
            else if (unit === 'm') label = `${val} min(s)`;
            else if (unit === 'h') label = `${val} hora(s)`;
            else label = `${Math.round(ms / 1000 * 10) / 10} seg(s)`;
            this.nextArrivalDisplay.textContent = `Siguiente llegada cada ${label}`;
        } else {
            // Show approx next arrival in virtual minutes
            const rem = Math.max(0, Math.ceil(this.nextArrivalTime - this.currentTime));
            this.nextArrivalDisplay.textContent = `Siguiente llegada (modo aleatorio) en ~${rem} min(s)`;
        }
    }

    createClient() {
        const client = {
            id: this.clientIdCounter++,
            arrivalTime: this.currentTime
        };
        this.clientsInQueue.push(client);
        this.renderQueue();
    }

    startService() {
        const client = this.clientsInQueue.shift(); // FIFO
        this.currentClient = client;
        this.isAtmBusy = true;
        this.serviceEndTime = this.currentTime + this.generateServiceTime();
        
        this.renderQueue();
        this.renderServer();
    }

    completeService() {
        this.clientsServed++;
        this.isAtmBusy = false;
        this.currentClient = null;
        this.renderServer();
    }

    // Formatting Helpers
    formatTime(totalMinutes) {
        const hoursPassed = Math.floor(totalMinutes / 60);
        const minutesPassed = Math.floor(totalMinutes % 60);
        
        let hour = this.START_HOUR + hoursPassed;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        
        if (hour > 12) hour -= 12;
        
        const hStr = hour.toString().padStart(2, '0');
        const mStr = minutesPassed.toString().padStart(2, '0');
        
        return `${hStr}:${mStr} ${ampm}`;
    }

    // UI Updates
    updateUI() {
        this.clockDisplay.textContent = this.formatTime(this.currentTime);
        this.queueCountDisplay.textContent = this.clientsInQueue.length;
        this.servedCountDisplay.textContent = this.clientsServed;
        
        if (this.isAtmBusy) {
            this.atmStatusDisplay.textContent = "OCUPADO";
            this.atmStatusDisplay.className = "status-indicator busy";
        } else {
            this.atmStatusDisplay.textContent = "LIBRE";
            this.atmStatusDisplay.className = "status-indicator idle";
        }
        this.updateNextArrivalUI();
    }

    renderQueue() {
        this.queueVisual.innerHTML = '';
        // Show max 10 clients visually to avoid overflow, but keep count correct
        const visibleClients = this.clientsInQueue.slice(0, 8); 
        
        visibleClients.forEach(client => {
            const el = document.createElement('div');
            el.className = 'client';
            el.textContent = '👤'; // Icon or ID
            el.title = `Cliente #${client.id}`;
            this.queueVisual.appendChild(el);
        });
        
        if (this.clientsInQueue.length > 8) {
            const more = document.createElement('div');
            more.style.color = 'var(--text-secondary)';
            more.style.fontSize = '0.8rem';
            more.textContent = `+${this.clientsInQueue.length - 8}`;
            this.queueVisual.appendChild(more);
        }
    }

    renderServer() {
        this.serverVisual.innerHTML = '';
        if (this.currentClient) {
            const el = document.createElement('div');
            el.className = 'client';
            el.style.backgroundColor = 'var(--accent-color)';
            el.textContent = '👤';
            this.serverVisual.appendChild(el);
        }
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new Simulation();
});