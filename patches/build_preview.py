import sys,re
d=sys.argv[1]; h=open(d+'/index.html').read(); css=open(d+'/styles.css').read(); js=open(d+'/app.js').read()
js=js.replace('if("serviceWorker" in navigator){','if(false&&"serviceWorker" in navigator){',1)
h=re.sub(r'\s*<link rel="manifest"[^>]*>','',h); h=re.sub(r'\s*<link rel="icon"[^>]*>','',h)
h=h.replace('<title>Klokify</title>','<title>Klokify v38</title>')
h=re.sub(r'<link rel="stylesheet" href="styles.css[^"]*" />',lambda m:'<style>\n'+css+'\n</style>',h)
h=re.sub(r'<script src="app.js[^"]*"></script>',lambda m:'<script>\n'+js+'\n</script>',h)
assert 'styles.css' not in h and 'app.js?' not in h
open(sys.argv[2],'w').write(h)
