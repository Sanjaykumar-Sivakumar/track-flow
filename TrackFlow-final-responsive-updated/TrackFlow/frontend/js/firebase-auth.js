/* Firebase email/password authentication and user-scoped Firestore access. */
const FirebaseAuthService = {
  auth: null, db: null, user: null, configured: false, started: false, listeners: [],
  isConfigured() {
    return !!(window.firebase && TRACKFLOW_FIREBASE_CONFIG.apiKey &&
      !TRACKFLOW_FIREBASE_CONFIG.apiKey.startsWith('REPLACE_') &&
      TRACKFLOW_FIREBASE_CONFIG.projectId && !TRACKFLOW_FIREBASE_CONFIG.projectId.startsWith('REPLACE_'));
  },
  start() {
    this.renderGate();
    if (!this.isConfigured()) { this.message('Firebase is not configured. Complete the setup in docs/SECURITY_SETUP.md. TrackFlow is locked until authentication is configured.'); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(TRACKFLOW_FIREBASE_CONFIG);
      this.auth = firebase.auth(); this.db = firebase.firestore(); this.configured = true; this.bindForm();
      this.auth.onAuthStateChanged(async user => {
        const prior = localStorage.getItem('trackflow_active_uid');
        const nextUid = user ? user.uid : null;
        const accountChanged = prior !== nextUid;
        if (accountChanged) {
          this.stopRealtimeSync();
          this.clearPrivateCache();
          // Clear in-memory state too: localStorage cleanup alone leaves the previous
          // account's dashboard visible until the next cloud request finishes.
          store.setState({ tasks: [], reports: [], goals: [], settings: { ...CONFIG.DEFAULT_SETTINGS }, syncStatus: 'saving', syncMessage: 'Syncing…' });
        }
        this.user = user || null;
        if (!user) {
          this.stopRealtimeSync();
          const app = document.querySelector('.app-container'); if (app) app.hidden = true;
          document.getElementById('trackflow-auth-gate').hidden = false;
          this.message('Sign in or create an account to access your private TrackFlow data.');
          localStorage.removeItem('trackflow_active_uid');
          document.getElementById('tf-account-chip')?.remove();
          return;
        }
        localStorage.setItem('trackflow_active_uid', user.uid);
        document.getElementById('trackflow-auth-gate').hidden = true;
        document.querySelector('.app-container').hidden = false;
        if (!this.started) { this.started = true; await App.init(); }
        else await ApiService.syncAllFromCloud();
        // Firestore listeners keep every view live without manual page refreshes.
        this.startRealtimeSync();
        this.showAccount();
      });
    } catch (e) { this.message('Firebase initialization failed. Verify your configuration and network connection.'); }
  },
  renderGate() {
    if (document.getElementById('trackflow-auth-gate')) return;
    const gate = document.createElement('section'); gate.id = 'trackflow-auth-gate'; gate.className = 'tf-auth-gate';
    gate.innerHTML = `
      <div class="tf-auth-orb tf-auth-orb-one" aria-hidden="true"></div><div class="tf-auth-orb tf-auth-orb-two" aria-hidden="true"></div>
      <div class="tf-auth-layout">
        <section class="tf-auth-story" aria-label="TrackFlow introduction">
          <a class="tf-auth-wordmark" href="#" aria-label="TrackFlow home"><span class="tf-auth-mark">T</span><span>TrackFlow</span></a>
          <div class="tf-auth-eyebrow"><span class="tf-live-dot"></span> YOUR FOCUS. YOUR FLOW.</div>
          <h1>Make every day<br><span>move you forward.</span></h1>
          <p class="tf-auth-story-copy">A calmer way to plan your day, build consistency, and see your progress add up.</p>
          <div class="tf-auth-feature-list"><div><span>↗</span><section><strong>Plan with intention</strong><small>Turn priorities into a clear daily rhythm.</small></section></div><div><span>◷</span><section><strong>Build momentum</strong><small>Track completion, goals, and streaks.</small></section></div><div><span>✦</span><section><strong>Your private workspace</strong><small>Your account, your personal progress.</small></section></div></div>
          <div class="tf-auth-footnote">Designed for focus. Built for consistency.</div>
        </section>
        <section class="tf-auth-card" aria-labelledby="tf-auth-title">
          <div class="tf-auth-mobile-brand"><span class="tf-auth-mark">T</span> TrackFlow</div>
          <div class="tf-auth-card-kicker" id="tf-auth-kicker">WELCOME BACK</div>
          <h2 id="tf-auth-title">Sign in to your space</h2>
          <p class="tf-auth-subtitle" id="tf-auth-subtitle">Pick up where you left off. Your next step starts here.</p>
          <div id="tf-auth-message" class="tf-auth-message" role="status" aria-live="polite">Preparing secure sign in…</div>
          <form id="tf-auth-form" novalidate>
            <div class="tf-auth-field"><label for="tf-auth-email">Email address</label><input id="tf-auth-email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required></div>
            <div class="tf-auth-field"><div class="tf-auth-label-row"><label for="tf-auth-password">Password</label><button id="tf-auth-reset" class="tf-auth-inline-link" type="button">Forgot password?</button></div><div class="tf-auth-password-wrap"><input id="tf-auth-password" type="password" autocomplete="current-password" minlength="8" placeholder="Enter your password" required><button id="tf-auth-password-toggle" class="tf-auth-eye" type="button" aria-label="Show password" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
            <button id="tf-auth-submit" class="tf-auth-submit" type="submit"><span>Sign in</span><span aria-hidden="true">→</span></button>
          </form>
          <div class="tf-auth-divider"><span>PRIVATE BY DESIGN</span></div>
          <p class="tf-auth-switchline"><span id="tf-auth-switch-copy">New to TrackFlow?</span> <button id="tf-auth-toggle" type="button">Create account</button></p>
          <p class="tf-auth-legal">By continuing, you access your own private productivity workspace.</p>
        </section>
      </div>`;
    document.body.prepend(gate); document.querySelector('.app-container').hidden = true;
  },
  message(s) { const el = document.getElementById('tf-auth-message'); if (el) el.textContent = s; },
  error(e) { const known = {'auth/invalid-email':'Enter a valid email address.','auth/invalid-credential':'Email or password is incorrect.','auth/user-not-found':'Email or password is incorrect.','auth/wrong-password':'Email or password is incorrect.','auth/email-already-in-use':'An account already exists for this email.','auth/weak-password':'Use a stronger password (at least 8 characters).','auth/too-many-requests':'Too many attempts. Wait before trying again.','auth/network-request-failed':'Network error. Check your connection.'}; return known[e.code] || 'Authentication failed. Check your details and Firebase configuration.'; },
  bindForm() {
    let mode = 'login';
    const byId = id => document.getElementById(id);
    const form = byId('tf-auth-form'), emailEl = byId('tf-auth-email'), passwordEl = byId('tf-auth-password');
    const submit = byId('tf-auth-submit'), toggle = byId('tf-auth-toggle'), reset = byId('tf-auth-reset');
    const setMode = next => {
      mode = next; const registering = mode === 'register';
      byId('tf-auth-kicker').textContent = registering ? 'START YOUR NEXT CHAPTER' : 'WELCOME BACK';
      byId('tf-auth-title').textContent = registering ? 'Create your account' : 'Sign in to your space';
      byId('tf-auth-subtitle').textContent = registering ? 'Set up your private workspace in a moment.' : 'Pick up where you left off. Your next step starts here.';
      byId('tf-auth-switch-copy').textContent = registering ? 'Already have an account?' : 'New to TrackFlow?';
      toggle.textContent = registering ? 'Sign in' : 'Create account';
      submit.querySelector('span').textContent = registering ? 'Create account' : 'Sign in';
      reset.hidden = registering; passwordEl.autocomplete = registering ? 'new-password' : 'current-password';
      passwordEl.setAttribute('aria-label', registering ? 'Create password' : 'Password');
      passwordEl.value = ''; byId('tf-auth-message').textContent = '';
      gateAnimate();
    };
    const gateAnimate = () => { const card = document.querySelector('.tf-auth-card'); if(card){ card.classList.remove('tf-auth-enter'); void card.offsetWidth; card.classList.add('tf-auth-enter'); } };
    toggle.onclick = () => setMode(mode === 'login' ? 'register' : 'login');
    byId('tf-auth-password-toggle').onclick = () => { const show = passwordEl.type === 'password'; passwordEl.type = show ? 'text' : 'password'; byId('tf-auth-password-toggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password'); byId('tf-auth-password-toggle').setAttribute('aria-pressed', String(show)); };
    form.onsubmit = async e => {
      e.preventDefault(); const email = emailEl.value.trim(), password = passwordEl.value;
      if (!emailEl.checkValidity()) { emailEl.reportValidity(); return; }
      if (password.length < 8) { this.message('Your password must contain at least 8 characters.'); passwordEl.focus(); return; }
      submit.disabled = true; submit.classList.add('is-loading'); submit.querySelector('span').textContent = mode === 'register' ? 'Creating account…' : 'Signing in…';
      try { if (mode === 'register') await this.auth.createUserWithEmailAndPassword(email,password); else await this.auth.signInWithEmailAndPassword(email,password); }
      catch (err) { this.message(this.error(err)); }
      finally { submit.disabled = false; submit.classList.remove('is-loading'); submit.querySelector('span').textContent = mode === 'register' ? 'Create account' : 'Sign in'; }
    };
    reset.onclick = async () => {
      const email = emailEl.value.trim();
      if (!email || !emailEl.checkValidity()) { this.message('Enter a valid email address above, then choose Forgot password.'); emailEl.focus(); return; }
      reset.disabled = true; this.message('Sending password-reset instructions…');
      try { await this.auth.sendPasswordResetEmail(email); this.message('If an account exists for this email, password-reset instructions have been sent. Check your inbox and spam folder.'); }
      catch (e) { this.message(this.error(e)); }
      finally { reset.disabled = false; }
    };
  },
  clearPrivateCache() { ['trackflow_tasks_v1','trackflow_reports_v1','trackflow_goals_v1','trackflow_settings_v1','trackflow_sync_queue_v1','trackflow_fired_reminders'].forEach(k=>localStorage.removeItem(k)); },
  showAccount() {
    const host = document.querySelector('.header-right'); if (!host || !this.user) return;
    let chip = document.getElementById('tf-account-chip');
    if (chip) { const email = chip.querySelector('[data-account-email]'); if (email) email.textContent = this.user.email || 'Signed in'; this.syncAccountVisibility(); return; }
    chip = document.createElement('div'); chip.id = 'tf-account-chip'; chip.className = 'tf-account-chip';
    const email = document.createElement('span'); email.dataset.accountEmail = 'true'; email.textContent = this.user.email || 'Signed in';
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Log out';
    btn.onclick = async () => { btn.disabled = true; try { await this.auth.signOut(); } catch (e) { btn.disabled = false; this.message(this.error(e)); } };
    chip.append(email, btn); host.prepend(chip);
    this.syncAccountVisibility();
  },
  // Keep account identity controls only on the Dashboard and Settings views.
  syncAccountVisibility(viewId) {
    const chip = document.getElementById('tf-account-chip');
    if (!chip) return;
    const activeView = viewId || document.querySelector('.view-section.active')?.id?.replace('view-', '') || 'dashboard';
    chip.hidden = !['dashboard', 'settings'].includes(activeView);
    chip.setAttribute('aria-hidden', chip.hidden ? 'true' : 'false');
  },
  stopRealtimeSync() { this.listeners.forEach(unsub => { try { unsub(); } catch (_) {} }); this.listeners = []; },
  startRealtimeSync() {
    if (!this.user || this.listeners.length) return;
    const uid = this.user.uid;
    const watch = (name, key) => this.col(name).onSnapshot(snapshot => {
      if (!this.user || this.user.uid !== uid) return;
      const values = snapshot.docs.map(d => d.data()).filter(row => row.ownerUid === uid);
      StorageService.set(CONFIG.STORAGE_KEYS[key], values);
      store.setState({ [key === 'TASKS' ? 'tasks' : key === 'REPORTS' ? 'reports' : 'goals']: values, syncStatus: 'synced', syncMessage: 'Synced' });
    }, err => { console.error('[TrackFlow] Realtime listener failed', err); store.setState({syncStatus:'offline',syncMessage:'Offline'}); });
    this.listeners.push(watch('tasks','TASKS'), watch('reports','REPORTS'), watch('goals','GOALS'));
    this.listeners.push(this.col('private').doc('settings').onSnapshot(snapshot => {
      if (!this.user || this.user.uid !== uid) return;
      const settings = snapshot.exists ? (snapshot.data().settings || {}) : { ...CONFIG.DEFAULT_SETTINGS };
      const merged = { ...CONFIG.DEFAULT_SETTINGS, ...settings };
      StorageService.set(CONFIG.STORAGE_KEYS.SETTINGS, merged); store.setState({settings:merged});
    }, err => console.error('[TrackFlow] Settings listener failed', err)));
  },
  col(name) { if(!this.user) throw new Error('Sign in required'); return this.db.collection('users').doc(this.user.uid).collection(name); },
  async request(method, action, payload={}) {
    if(!this.user) throw new Error('Sign in required');
    const uid=this.user.uid, now=new Date().toISOString();
    const list=async name=>(await this.col(name).get()).docs.map(d=>d.data()).filter(row=>row.ownerUid===uid);
    const save=async(name,id,value)=>this.col(name).doc(String(id)).set({...value,ownerUid:uid,updatedAt:now},{merge:true});
    switch(action) {
      case 'ping': case 'init': return {success:true};
      case 'getTasks': return {success:true,tasks:await list('tasks')};
      case 'saveTask': {
        const t={...payload.task,ownerUid:uid}; t.taskId=t.taskId||'tsk_'+crypto.randomUUID(); t.createdAt=t.createdAt||now;
        await save('tasks',t.taskId,t);
        const tasks=[t,...(store.state.tasks||[]).filter(x=>x.taskId!==t.taskId)];
        StorageService.set(CONFIG.STORAGE_KEYS.TASKS,tasks); store.setState({tasks,syncStatus:'synced',syncMessage:'Synced'});
        return {success:true,task:t};
      }
      case 'updateTaskStatus': {
        const ref=this.col('tasks').doc(String(payload.taskId)), snap=await ref.get();
        if(!snap.exists) return {success:false,error:'Task not found'};
        if(snap.data().ownerUid!==uid) throw new Error('Not authorized');
        const update={status:payload.status,updatedAt:now,completedAt:payload.status==='completed'?(snap.data().completedAt||now):''};
        if(payload.notes!==undefined) update.notes=payload.notes;
        await ref.update(update);
        const tasks=(store.state.tasks||[]).map(t=>t.taskId===payload.taskId?{...t,...update}:t);
        StorageService.set(CONFIG.STORAGE_KEYS.TASKS,tasks); store.setState({tasks,syncStatus:'synced',syncMessage:'Synced'});
        return {success:true};
      }
      case 'deleteTask': {
        const ref=this.col('tasks').doc(String(payload.taskId)), snap=await ref.get();
        if(snap.exists && snap.data().ownerUid!==uid) throw new Error('Not authorized');
        if(snap.exists) await ref.delete();
        const tasks=(store.state.tasks||[]).filter(t=>t.taskId!==payload.taskId);
        StorageService.set(CONFIG.STORAGE_KEYS.TASKS,tasks); store.setState({tasks,syncStatus:'synced',syncMessage:'Synced'});
        return {success:true};
      }
      case 'getDailyReports': return {success:true,reports:await list('reports')};
      case 'saveDailyReport': {const r={...payload.report}; r.reportId=r.reportId||'rep_'+r.date; r.submittedAt=r.submittedAt||now; await save('reports',r.reportId,r); return {success:true,report:r};}
      case 'getGoals': return {success:true,goals:await list('goals')};
      case 'saveGoal': {const g={...payload.goal}; g.goalId=g.goalId||'gol_'+crypto.randomUUID(); g.createdAt=g.createdAt||now; await save('goals',g.goalId,g); return {success:true,goal:g};}
      case 'deleteGoal': {const ref=this.col('goals').doc(String(payload.goalId)), snap=await ref.get(); if(snap.exists && snap.data().ownerUid!==uid) throw new Error('Not authorized'); if(snap.exists) await ref.delete(); return {success:true};}
      case 'getSettings': {const snap=await this.col('private').doc('settings').get(); const data=snap.exists?snap.data():null; return {success:true,settings:data&&data.ownerUid===uid?data.settings:{...CONFIG.DEFAULT_SETTINGS}};}
      case 'saveSettings': await this.col('private').doc('settings').set({ownerUid:uid,settings:{...store.state.settings,...payload.settings},updatedAt:now},{merge:true}); return {success:true};
      default: throw new Error('Unsupported cloud action: '+action);
    }
  }
};
