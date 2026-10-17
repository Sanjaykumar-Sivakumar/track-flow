/**
 * TrackFlow - Settings Management Controller
 */
const SettingsManager = {
  /**
   * Save user settings from the settings form
   */
  async saveSettings(formData) {
    const newSettings = {
      ...store.state.settings,
      ...formData
    };

    // Apply theme immediately
    if (newSettings.theme) {
      this.applyTheme(newSettings.theme);
    }

    // Save cloud configuration
    if (formData.gasUrl !== undefined) {
      ApiService.setGasUrl(formData.gasUrl);
    }
    if (formData.authToken !== undefined) {
      ApiService.setAuthToken(formData.authToken);
    }

    // Save to backend & storage
    const res = await ApiService.request('POST', 'saveSettings', { settings: newSettings });
    return res;
  },

  /**
   * Test connection to Google Apps Script Web App
   */
  async testConnection(gasUrl, authToken) {
    if (!gasUrl || !gasUrl.startsWith('https://script.google.com/macros/s/')) {
      return { 
        success: false, 
        message: 'Invalid Google Apps Script Web App URL. It must begin with "https://script.google.com/macros/s/..."' 
      };
    }

    try {
      let testUrl = gasUrl + (gasUrl.includes('?') ? '&' : '?') + 'action=ping';
      if (authToken) testUrl += '&authToken=' + encodeURIComponent(authToken);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(testUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, message: `HTTP Error ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      if (data.success) {
        return { 
          success: true, 
          message: `Connected successfully! Google Apps Script Web App responded at ${data.timestamp || 'now'}.` 
        };
      } else {
        return { success: false, message: data.error || 'Server rejected connection ping.' };
      }
    } catch (err) {
      return { 
        success: false, 
        message: `Connection failed: ${err.message}. Please verify the Web App deployment has "Execute as: Me" and "Who has access: Anyone".` 
      };
    }
  },

  /**
   * Initialize Google Sheets schema from Settings
   */
  async initializeSpreadsheet() {
    if (!ApiService.isCloudConnected()) {
      return { success: false, message: 'Please enter and test your Google Apps Script Web App URL first.' };
    }

    try {
      const res = await ApiService.request('GET', 'init');
      return res;
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  /**
   * Apply UI theme (dark, light, or system)
   */
  applyTheme(theme) {
    let activeTheme = theme;
    if (theme === 'system') {
      activeTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    document.documentElement.setAttribute('data-theme', activeTheme);
    StorageService.set(CONFIG.STORAGE_KEYS.THEME, theme);
  },


  /** Export current account data as a genuine .xlsx workbook with one combined sheet. */
  exportExcel() {
    const state = store.state;
    const xml = value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const rows = [['Data type','Name / Task','Date / Month','Start time','End time','Category','Priority','Status','Points / Score','Details']];
    (state.tasks || []).forEach(t => rows.push(['Task', t.title || t.task || '', t.date || '', t.startTime || '', t.endTime || '', t.category || '', t.priority || '', t.status || '', t.points ?? '', t.notes || '']));
    (state.reports || []).forEach(r => rows.push(['Daily report', r.title || 'Daily review', r.date || '', '', '', '', '', r.status || '', r.score ?? '', r.summary || r.notes || r.submittedAt || '']));
    (state.goals || []).forEach(g => rows.push(['Goal', g.title || g.name || '', g.month || g.date || '', '', '', '', '', g.status || '', g.progress ?? g.target ?? '', g.description || '']));
    const colName = n => { let out=''; while(n>0){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26);}return out; };
    const sheetRows = rows.map((row, ri) => '<row r="'+(ri+1)+'">'+row.map((v, ci) => {
      const ref = colName(ci+1)+(ri+1); const value = String(v == null ? '' : v);
      if (typeof v === 'number' && Number.isFinite(v)) return '<c r="'+ref+'" t="n"><v>'+v+'</v></c>';
      return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
    }).join('')+'</row>').join('');
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheetRows+'</sheetData></worksheet>';
    const files = [
      ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="TrackFlow Data" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml',sheet]
    ];
    const encoder = new TextEncoder();
    const crc32 = bytes => { let c=0xffffffff; for (const b of bytes) { c ^= b; for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; };
    const parts=[], central=[]; let offset=0;
    const u16=(v)=>[v&255,(v>>>8)&255]; const u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
    for (const [name, content] of files) {
      const nb=encoder.encode(name), data=encoder.encode(content), crc=crc32(data);
      const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(33),...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...nb,...data]);
      parts.push(local);
      const cd=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(33),...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nb]);
      central.push(cd); offset+=local.length;
    }
    const centralSize=central.reduce((sum,a)=>sum+a.length,0), end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),...u16(0)]);
    const blob=new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`trackflow-export-${state.activeDate || new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  },

  /**
   * Export all user data as JSON file
   */
  exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      app: CONFIG.APP_NAME,
      version: CONFIG.VERSION,
      tasks: store.state.tasks,
      reports: store.state.reports,
      goals: store.state.goals,
      settings: store.state.settings
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackflow-backup-${store.state.activeDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
