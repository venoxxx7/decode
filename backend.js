// Supabase adapter: provides the small runtime API the Decode app expects.
(function () {
  const C = window.DECODE || {};
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  let session = null;
  const listeners = {};
  const ready = sb.auth.getSession().then(r => { session = r.data && r.data.session; });

  sb.auth.onAuthStateChange((ev, s) => {
    session = s;
    if (ev === 'PASSWORD_RECOVERY') {
      const p = prompt('Enter your new password (min 8 characters):');
      if (p) sb.auth.updateUser({ password: p }).then(r => alert(r.error ? r.error.message : 'Password updated.'));
    }
  });

  const refetch = path => listeners[path] && listeners[path].forEach(f => f());

  const db = {
    collection: path => ({
      onSnapshot(cb, onErr) {
        const run = async () => {
          const { data, error } = await sb.from('docs').select('id,data').eq('path', path);
          if (error) { onErr && onErr(error); return; }
          cb({ docs: data.map(r => ({ data: () => r.data })) });
        };
        (listeners[path] = listeners[path] || []).push(run);
        run();
        const ch = sb.channel('c:' + path + ':' + Math.random())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'path=eq.' + path }, run)
          .subscribe();
        return () => { sb.removeChannel(ch); listeners[path] = listeners[path].filter(f => f !== run); };
      },
      doc: id => ({
        set: async data => {
          const { error } = await sb.from('docs').upsert({ path, id, data, updated_at: new Date().toISOString() });
          if (error) throw error;
          refetch(path);
        },
        delete: async () => {
          const { error } = await sb.from('docs').delete().eq('path', path).eq('id', id);
          if (error) throw error;
          refetch(path);
        }
      })
    })
  };

  window.claude = {
    use: async name => {
      await ready;
      if (!session) return null;
      const u = session.user;
      if (name === 'user') return {
        id: async () => u.id,
        me: async () => ({ name: (u.user_metadata && u.user_metadata.name) || u.email, email: u.email }),
        isOwner: async () => (C.ADMIN_EMAILS || []).map(x => x.toLowerCase()).includes((u.email || '').toLowerCase())
      };
      if (name === 'db') return db;
      if (name === 'assets') return {
        upload: async file => {
          const p = u.id + '/' + Date.now() + '-' + file.name.replace(/[^\w.]/g, '_');
          const up = await sb.storage.from('shots').upload(p, file);
          if (up.error) throw up.error;
          const s = await sb.storage.from('shots').createSignedUrl(p, 31536000);
          if (s.error) throw s.error;
          return { url: s.data.signedUrl };
        }
      };
      if (name === 'downloads') return {
        save: async ({ filename, data }) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([data]));
          a.download = filename; a.click();
        }
      };
      return null; // 'sample' (AI) is not available without a server-side proxy
    }
  };

  // Login form shown by the app's login screen when nobody is signed in.
  window.dxLoginHTML = () =>
    '<input id="dxe" type="email" placeholder="Email" autocomplete="username">' +
    '<input id="dxp" type="password" placeholder="Password" autocomplete="current-password">' +
    '<button class="pri" data-a="dxin">Sign in</button>' +
    '<button class="ghost" data-a="dxforgot">Forgot password?</button>' +
    '<span class="neg" id="dxerr"></span>';

  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'dxin' || a === 'dxforgot') {
      const em = (document.getElementById('dxe') || {}).value || '';
      const pw = (document.getElementById('dxp') || {}).value || '';
      const say = m => setTimeout(() => { const x = document.getElementById('dxerr'); if (x) x.textContent = m; }, 50);
      if (!em) return say('Enter your email.');
      if (a === 'dxforgot') {
        const r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin });
        return say(r.error ? r.error.message : 'Password reset email sent.');
      }
      const r = await sb.auth.signInWithPassword({ email: em, password: pw });
      if (r.error) return say(r.error.message);
      location.reload();
    }
    if (a === 'logout') { await sb.auth.signOut(); location.reload(); }
  }, true);
})();
