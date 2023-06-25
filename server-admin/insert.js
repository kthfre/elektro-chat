const { Client } = require('pg')
const argon2 = require('argon2');

// configure according to needs
const client = new Client({
  database: 'elektrouser',
  user: 'postgres',
  password: 'postgres',
});

const usernames = ["username1", "username2", "username3"]; // change
const password = ["password1", "password2", "password3"]; // change
let hashes = [];
let promises = [];

for (let i = 0; i < password.length; i++) {
  promises.push(argon2.hash(password[i]));
}

Promise.all(promises).then(res => {
  for (let i = 0; i < res.length; i++) {
    hashes.push(res[i]);
  }
}).then(() => {
  client.connect().then(res => {
    promises = [];
    console.log("connected to postgresql")
    console.log(res)
    console.log("inserting users")
    const text = 'INSERT INTO users(username, password) VALUES($1, $2) RETURNING *';
    for (let i = 0; i < usernames.length; i++) {
      promises.push(client.query(text, [usernames[i], hashes[i]]));
    }
  }).catch(err => {
    console.log("failed to connect to postgres")
    console.log(err)
  });

  Promise.all(promises).then(res => {
    console.log("ALL INSERTED")
    console.log(res);
  }).catch(err => {
    console.log("FAILED INSERT FOR SOME REASON")
    console.log(err)
  })
});