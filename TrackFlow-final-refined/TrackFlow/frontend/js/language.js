/** TrackFlow bilingual UI (English / Tamil). Language preference is device-local. */
const LanguageManager = {
  KEY: 'trackflow_ui_language',
  dictionaries: {
    ta: {
      'Dashboard':'முகப்புப்பலகை','My Schedule':'எனது அட்டவணை','All Tasks':'அனைத்து பணிகள்','EOD Review':'நாள் முடிவு மதிப்பாய்வு','Monthly Goals':'மாத இலக்குகள்','Analytics':'புள்ளிவிவரங்கள்','Settings':'அமைப்புகள்','Log out':'வெளியேறு','Quick Add':'விரைவாகச் சேர்',
      'Profile Settings':'சுயவிவர அமைப்புகள்','Manage your name, profile photo and account password.':'உங்கள் பெயர், சுயவிவரப் படம் மற்றும் கடவுச்சொல்லை நிர்வகிக்கவும்.','Profile photo':'சுயவிவரப் படம்','PNG, JPG or WebP. Stored for this account on this device.':'PNG, JPG அல்லது WebP. இந்த சாதனத்தில் இந்தக் கணக்கிற்காகச் சேமிக்கப்படும்.','Your name':'உங்கள் பெயர்','Enter your name':'உங்கள் பெயரை உள்ளிடவும்','Save Profile':'சுயவிவரத்தைச் சேமி','Change password':'கடவுச்சொல்லை மாற்று','Current password':'தற்போதைய கடவுச்சொல்','New password':'புதிய கடவுச்சொல்','Confirm new password':'புதிய கடவுச்சொல்லை உறுதிப்படுத்து','Update Password':'கடவுச்சொல்லைப் புதுப்பி',
      'Productivity & Scoring Settings':'உற்பத்தித்திறன் மற்றும் மதிப்பெண் அமைப்புகள்','Successful Day Threshold (%)':'வெற்றிகரமான நாளுக்கான இலக்கு (%)','Default: 80% daily score':'இயல்புநிலை: தினசரி மதிப்பெண் 80%','Scoring Mode':'மதிப்பெண் முறை','Weighted Points (Custom points per task)':'எடையிட்ட புள்ளிகள் (ஒவ்வொரு பணிக்கும் தனிப்புள்ளிகள்)','Equal Points (Auto-divided to 100)':'சம புள்ளிகள் (100 ஆகத் தானாகப் பகிரப்படும்)','Daily Review Time':'தினசரி மதிப்பாய்வு நேரம்','Default: 9:00 PM (21:00)':'இயல்புநிலை: இரவு 9:00 (21:00)','Timezone':'நேர மண்டலம்','Notifications & Quiet Hours':'அறிவிப்புகள் மற்றும் அமைதிநேரம்','Enable notifications':'அறிவிப்புகளை இயக்கு','Turn task reminders and productivity notifications on or off.':'பணி நினைவூட்டல்கள் மற்றும் உற்பத்தித்திறன் அறிவிப்புகளை இயக்கவும் அல்லது நிறுத்தவும்.','Quiet Hours Start':'அமைதிநேரம் தொடக்கம்','Quiet Hours End':'அமைதிநேரம் முடிவு','Default Task Lead Time':'பணி நினைவூட்டல் முன்நேரம்','5 minutes before':'5 நிமிடங்களுக்கு முன்','10 minutes before':'10 நிமிடங்களுக்கு முன்','15 minutes before':'15 நிமிடங்களுக்கு முன்','30 minutes before':'30 நிமிடங்களுக்கு முன்','Theme':'தோற்றம்','Dark Mode':'இருண்ட தோற்றம்','Light Mode':'ஒளிரும் தோற்றம்','System Default':'சாதனத்தின் இயல்புநிலை','Language':'மொழி','English':'ஆங்கிலம்','Tamil':'தமிழ்','Choose the language used throughout TrackFlow.':'TrackFlow முழுவதும் பயன்படுத்த வேண்டிய மொழியைத் தேர்ந்தெடுக்கவும்.','Test Notification':'அறிவிப்பைச் சோதிக்கவும்','Save Settings':'அமைப்புகளைச் சேமி','Data Management & Backup':'தரவு மேலாண்மை மற்றும் காப்புப்பிரதி','Export All Data (Excel)':'அனைத்து தரவையும் ஏற்றுமதி செய் (Excel)','Reset Local Cache to Demo':'உள்ளூர் தற்காலிகத் தரவை மீட்டமை','Save Profile':'சுயவிவரத்தைச் சேமி',
      'Today\'s Productivity Score':'இன்றைய உற்பத்தித்திறன் மதிப்பெண்','Make every day move you forward.':'ஒவ்வொரு நாளும் உங்களை முன்னேற்றட்டும்.','Your focus. Your flow.':'உங்கள் கவனம். உங்கள் முன்னேற்றம்.','Welcome back':'மீண்டும் வரவேற்கிறோம்','Sign in to your space':'உங்கள் இடத்தில் உள்நுழையவும்','Email address':'மின்னஞ்சல் முகவரி','Password':'கடவுச்சொல்','Forgot password?':'கடவுச்சொல்லை மறந்துவிட்டீர்களா?','Create account':'கணக்கை உருவாக்கு','Sign in':'உள்நுழை','Planned points earned':'பெற்ற திட்டமிட்ட புள்ளிகள்','Status: Pending Action':'நிலை: செயல் நிலுவையில்','Success Target: 80%':'வெற்றி இலக்கு: 80%','Next Scheduled: review':'அடுத்த திட்டமிட்ட பணி: மதிப்பாய்வு','Overdue Task':'காலக்கெடு கடந்த பணி','Tasks scheduled earlier today still marked as pending.':'இன்று முன்பே திட்டமிடப்பட்ட பணிகள் இன்னும் நிலுவையில் உள்ளன.','0% Rate':'0% நிறைவு விகிதம்','days':'நாட்கள்','Balance 100 Pts':'மீதம் 100 புள்ளிகள்','Full Analytics':'முழு புள்ளிவிவரங்கள்','Search':'தேடு','Search tasks...':'பணிகளைத் தேடு...','Add New Task':'புதிய பணியைச் சேர்','Edit Task':'பணியைத் திருத்து','Task Title':'பணியின் தலைப்பு','Description':'விளக்கம்','Date':'தேதி','Start Time':'தொடக்க நேரம்','End Time':'முடிவு நேரம்','Category':'வகை','Priority':'முன்னுரிமை','Status':'நிலை','Notes':'குறிப்புகள்','Save Task':'பணியைச் சேமி','Cancel':'ரத்துசெய்','Delete':'நீக்கு','Edit':'திருத்து','Today':'இன்று','Tomorrow':'நாளை','This Week':'இந்த வாரம்','All':'அனைத்தும்','Pending':'நிலுவையில்','In Progress':'நடைபெறுகிறது','Low':'குறைவு','Medium':'நடுத்தரம்','High':'அதிகம்','Study':'படிப்பு','Coding':'நிரலாக்கம்','Project':'திட்டம்','Work':'வேலை','Personal':'தனிப்பட்டது','Health':'உடல்நலம்','Other':'மற்றவை','No tasks found':'பணிகள் எதுவும் இல்லை','Create Goal':'இலக்கை உருவாக்கு','Monthly Goal':'மாத இலக்கு','Progress':'முன்னேற்றம்','Export':'ஏற்றுமதி','Save':'சேமி','Close':'மூடு','Ready':'தயார்','Task added successfully':'பணி வெற்றிகரமாகச் சேர்க்கப்பட்டது','Task deleted successfully':'பணி வெற்றிகரமாக நீக்கப்பட்டது','Settings saved successfully':'அமைப்புகள் வெற்றிகரமாகச் சேமிக்கப்பட்டன','Planned Tasks':'திட்டமிட்ட பணிகள்','Completed':'முடிக்கப்பட்டவை','Pending / Remaining':'நிலுவையில் / மீதமுள்ளவை','Consistency Streak':'தொடர்ச்சிப் பதிவு','Today\'s Schedule':'இன்றைய அட்டவணை','Weekly Productivity Trend':'வாராந்திர உற்பத்தித்திறன் போக்கு','Add Task':'பணியைச் சேர்','Mark Done':'முடிந்தது எனக் குறி','Review Tasks':'பணிகளை மதிப்பாய்வு செய்','Synced':'ஒத்திசைக்கப்பட்டது','Syncing':'ஒத்திசைக்கிறது','Offline':'இணையமில்லை','Error':'பிழை','Local':'உள்ளூர்'
    }
  },
  current() { try { return localStorage.getItem(this.KEY) === 'ta' ? 'ta' : 'en'; } catch (_) { return 'en'; } },
  setLanguage(language) {
    const lang = language === 'ta' ? 'ta' : 'en';
    try { localStorage.setItem(this.KEY, lang); } catch (_) {}
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
    if (typeof App !== 'undefined') App.render();
    else this.translatePage();
  },
  translatePage() {
    const lang = this.current();
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
    if (lang !== 'ta') return;
    const dict = this.dictionaries.ta;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/i.test(parent.tagName) || parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const raw = node.nodeValue, trimmed = raw.trim();
      if (dict[trimmed]) node.nodeValue = raw.replace(trimmed, dict[trimmed]);
    });
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      if (dict[el.placeholder]) el.placeholder = dict[el.placeholder];
    });
  }
};
