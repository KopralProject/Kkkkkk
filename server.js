// server.js
const express    = require('express');
const bodyParser = require('body-parser');
const { Client } = require('ssh2');
const db         = require('./db');
const app        = express();

const VPS = {
  host: '54.179.100.131',
  port: 22,
  username: 'root',
  privateKey: require('fs').readFileSync('/root/.ssh/id_rsa')
};

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Halaman utama & daftar akun
app.get('/', (req, res) => {
  db.all("SELECT * FROM accounts", (e, rows) => res.render('list', { rows }));
});

// Form buat akun
app.get('/create', (req, res) => res.render('index'));

// Proses pembuatan akun
app.post('/create', (req, res) => {
  const { type, user, days } = req.body;
  const conn = new Client();

  conn.on('ready', () => {
    let cmd = '';
    if (type === 'ssh') {
      cmd = `
        useradd -M -s /usr/sbin/nologin ${user} &&
        echo "${user}:${user}@vpn" | chpasswd &&
        echo "PASSWORD=${user}@vpn"
      `;
    } else {
      // generate UUID atau password trojan
      const proto = type.toLowerCase();
      const configFile = '/etc/xray/config.json';
      cmd = `
        id=$(cat /proc/sys/kernel/random/uuid) &&
        pw=$([[ "${proto}"=="trojan" ]] && echo "$id" || echo "") &&
        jq --arg id "$id" --arg user "${user}" \
           '.inbounds[] | select(.protocol=="${proto}" ).settings.clients +=
            [{"id":$id,"flow":"","email":$user,"password":$pw}]' \
           ${configFile} > /tmp/config.new.json &&
        mv /tmp/config.new.json ${configFile} &&
        systemctl restart xray &&
        echo "ID=$id" && echo "PWD=$pw"
      `;
    }

    conn.exec(cmd, (err, stream) => {
      let output = '';
      stream.on('data', d => output += d.toString())
            .on('close', () => {
              conn.end();
              // parsing credential
              const lines = output.trim().split('\n');
              const cred  = lines.join('; ');
              const expiry = new Date(Date.now() + days*864e5).toISOString().split('T')[0];
              // simpan ke DB
              db.run(
                "INSERT INTO accounts(type,user,credential,expire) VALUES(?,?,?,?)",
                [type, user, cred, expiry]
              );
              res.render('result', { type, user, cred, expiry });
            });
    });
  }).connect(VPS);
});

app.listen(3000, () => console.log('Panel berjalan di http://localhost:3000'));
