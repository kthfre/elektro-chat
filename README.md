# Installation

This readme will cover installation from the scratch, step by step. During development python 3.10 was used. Python 3.11 was not supported. Some steps for installing certain software may vary for different operating systems. The server that is being used in this example installation is running Debian 11. 

At first the different main software used will be installed and configured, followed by frameworks and packages.

### Python

To install python 3.10 which is used for the python venv the Rasa parts of the application will be run in.

```
sudo apt update && sudo apt upgrade -y
sudo apt install build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev libsqlite3-dev wget libbz2-dev
wget https://www.python.org/ftp/python/3.10.12/Python-3.10.12.tgz
tar -xf Python-3.10.12.tgz
cd Python-3.10.12/
./configure --prefix=/usr/local --enable-optimizations --enable-shared LDFLAGS="-Wl,-rpath /usr/local/lib"
make -j $(nproc)
sudo make altinstall
```

The installation can be verified by

``
python3.10 --version
``

### Node.js

To install a compatible version of Node.js.

```
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt update && sudo apt upgrade
sudo apt install -y nodejs
```

## Databases

Next the different neccessary databases used are installed.

### Neo4j

The enterprise version of Neo4j has been used during development, where Neo4j-desktop comes with a free development enterprise license, but the free community version will likely work as well. Read more about their licenses here: https://neo4j.com/licensing/. Following the steps of their installation documentation https://neo4j.com/docs/operations-manual/current/installation/linux/debian/

```
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable 5' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
sudo apt-get update
```

At the time of this writing the latest version is 5.8.0.

``
apt list -a neo4j
``

Which is installed (you may want to go community edition here).

``
sudo apt-get install neo4j-enterprise=1:5.8.0
``

To update the configuration, open the configuration file with any editor of your liking.

``
sudo nano /etc/neo4j/neo4j.conf
``

Add/uncomment/modify the following lines:

```
dbms.netty.ssl.provider=OPENSSL

server.default_listen_address=0.0.0.0

server.bolt.tls_level=OPTIONAL
server.bolt.listen_address=:7687

server.http.enabled=false

server.https.enabled=true
server.https.listen_address=:7473

dbms.ssl.policy.bolt.trust_all=true
dbms.ssl.policy.https.trust_all=true

dbms.ssl.policy.bolt.enabled=true
dbms.ssl.policy.bolt.base_directory=certificates/bolt
dbms.ssl.policy.bolt.private_key=private.key
dbms.ssl.policy.bolt.public_certificate=public.crt
dbms.ssl.policy.bolt.client_auth=NONE

dbms.ssl.policy.https.enabled=true
dbms.ssl.policy.https.base_directory=certificates/https
dbms.ssl.policy.https.private_key=private.key
dbms.ssl.policy.https.public_certificate=public.crt
dbms.ssl.policy.https.client_auth=NONE
```

You would want to get a certificate from a certificate authority but the shortcut of self-signed certificates will be taken here. To generate the certificate and private key proceed through the process

``
openssl req -newkey rsa:2048 -nodes -keyout private.key -x509 -days 180 -out public.crt
``

Now create the following folders

``
sudo mkdir /var/lib/neo4j/certificates/bolt
sudo mkdir /var/lib/neo4j/certificates/bolt/trusted
sudo mkdir /var/lib/neo4j/certificates/bolt/revoked
sudo mkdir /var/lib/neo4j/certificates/https
sudo mkdir /var/lib/neo4j/certificates/https/trusted
sudo mkdir /var/lib/neo4j/certificates/https/revoked
``

Now lets install the required Neo4j plugins.

Some database queries of ElektroCHAT relies on APOC calls. If the plugin is bundled with the installation and located in the labs folder, then simply move it from there to the plugins folder (version number may naturally differ).

``
sudo mv /var/lib/neo4j/labs/apoc-5.8.0-core.jar /var/lib/neo4j/plugins/
``

Otherwise, visit https://neo4j.com/labs/apoc/5/installation/ and fetch the appropriate jar.

To enable tls/ssl connections Neo4j relies on Netty which require the tcnative library. See their documentation for which specific version is required by the specific Neo4j version you are running https://neo4j.com/docs/operations-manual/current/security/ssl-framework/.

In this case (and for the vast majority of Neo4j versions) the following applies

```
https://search.maven.org/artifact/io.netty/netty-tcnative-boringssl-static/2.0.52.Final/jar
https://search.maven.org/artifact/io.netty/netty-tcnative-classes/2.0.52.Final/jar
```

Move the appropriate jar files to

``
/var/lib/neo4j/plugins/
``

Check whether Neo4j is running

``
neo4j-admin server status
``

If it is, restart it with `sudo neo4j-admin server restart`, otherwise start it with `sudo neo4j-admin server start`.

### PostgreSQL

PostgreSQL is also required so the steps of the official documentation are followed https://www.postgresql.org/download/linux/debian/:

```
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get -y install postgresql
```

A user database for authentication of the knowledge base client also needs to be created along with  a postgresql user . Change the username and password, as well as database name, according to preference.

```
sudo -u postgres psql postgres
CREATE ROLE username LOGIN PASSWORD 'password';
CREATE DATABASE elektrouser WITH OWNER = username;
```

Lets also create the table to hold our users while still in psql.

```
\c elektrouser
CREATE TABLE users(username VARCHAR(64) PRIMARY KEY, password TEXT NOT NULL);
```

Grant privileges to the newly created user (change username and potentially database depending on what you configured previously).

```
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public to username" -d elektrouser
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public to username" -d elektrouser
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public to username" -d elektrouser
```

There is no registration page or similar, instead the users must be inserted manually. To help with this there is a script in the github repository called insert.js. Modify the usersnames and password variables according to your needs. Also modify the client variable to match the configuration you just did with regards to user and database name.

```
usernames = ["user1", "user2", "user3"];
passwords = ["password1", "password2", "password3"];
```

Then simply run `node insert.js`.

## Rasa and virtual environment

Prior to creating the venv and installing Rasa, to fulfill the requirements of Rasa, a Rust compiler is installed. Rasa's official documentation can be found here https://rasa.com/docs/rasa/installation/installing-rasa-open-source.

``
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
``

Follow through with the installation when prompted.

The next step is to create the python venv, activate it, and install Rasa (folder names may of course be modified to your likings)

```
python3.10 -m venv ./rasa
cd rasa/
source bin/activate
```


Rasa as well as the additional dependencies of ElektroCHAT need now be installed. First install the python packages by using the `requirements.txt` of the github repository

``
pip install -r requirements.txt
``

Newer versions of Rasa and the Rasa SDK may be compatible, but as with all other software, use at own risk.

A clean install of Rasa will be initialized and the required files of ElektroCHAT will be copied into the project replacing some of the default files. Create some directory to hold the project and initiliaze a new project, like so:

```
mkdir rasa_elektro
cd rasa_elektro/
rasa init
```

Go through the installation process any way you like. Here the current directory was used, and answered no to training models as that will be done at a later stage.


Using the corresponding files from the git repository, replace (or create) the following files:

```
config.yml
credentials.yml
domain.yml
endpoints.yml
actions/actions.py
actions/graph_db.py
actions/util.py
data/nlu.yml
data/rules.yml
data/stories.yml
connectors/external_trigger_channel.py
```

Now is a good time to update the training data in the `data/nlu.yml` file for usage in a different domain if needed. Rules and stories, as well as the domain file, may also be updated according to needs. This may also be done at some later point. When satisfied, run

```
rasa train --force
```

Some of the language models are of considerable size, so depending on your hardware specifications you may not be able to hold them all in memory. It is recommended to have at least 16gb ram. Download the following files:

```
wget https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.sv.300.bin.gz
wget http://vectors.nlpl.eu/repository/20/69.zip
```

If needed install unzip and gzip.

```
sudo apt install unzip
sudo apt install gzip
```

Uncompress the following two files to the models folder and rename the word2vec model

```
unzip 69.zip
gzip -dk cc.sv.300.bin.gz
mv model.bin word2vec.sv.100.conll17.bin
```

At the top of the `actions/util.py` file you can control which models are loaded and used in the semantic similarity matching by simply changing the first value of each of the model tuples of the `enabled_models` variable. Setting them to True naturally means to load the model, and False to exclude it. You must also update the base_models_folder with the absolute path to the models folder in your rasa project including the succeedings "/" (i.e. "/home/user/rasa_project/models/"). It is recommended to have at least have one of the distributional models and Sentence-BERT. The fastText embeddings are the most demanding from a hardware perspective and may cause issues with systems with less ram.

If needed, update the database details of Neo4j in the constructor of the GraphDBHandler class at the top of the file `actions/graph_db.py`.

## Dialogue system server & Knowledge base server

Fetch the files from the github repository and run

``
npm install
``

If needed, modify the Neo4j database details of the `driver` variable at the top of the `index.js` file.

You may also configure the `port` and `portHttps` variables according to preferences, and make sure to configure any firewall accordingly.

According to preference either generate a new private key and public certificate or reuse the ones since before. Update the variable options close to the top of the index.js file with the respective paths.

The server may then be launched by simply running

``
node index.js
``

The above applies to both the dialogue system server and knowledge base server. Additionally for the knowledge base server, update the values of the `client` variable in the `verifyUser` function of the `index.js` file, according to the PostgreSQL configuration you previously set.

## Dialogue system client & Knowledge base client

If the clients are to be served by the server configured above, which they are here, simply make sure the `URI` variable at the top of the following files, where it exists, is set to `window.location.href`.

```
src/App.js
src/view/*
```

Then run `npm build`.

Copy the following files from the respective clients to the respective servers (create folders as neccessary)

```
cp client/build/index.html server/public
cp client/build/static/css server/public/static/css
cp client/build/static/js  server/public/static/js
```

## Compatibility

Most of the packages are installed as a result of the respective `requirements.txt` and `package.json` files. Besides this, the following versions of the core software have been used at the different system. Other versions may work, but use at own risk. The system has been tested reliably on both Debian 11 and recent Arch Linux configurations.

```
Python 3.10
Neo4j 5.7.0 and 5.8.0
Node.js 18.16.0 and 20.2.0
PostgreSQL 15.3
```

Python 3.11 is not compatible, and that is presumably the case with future releases of python as well. This is likely entirely due to Rasa, and future Rasa versions may fix it. Node 18.x or later must be used.

## Using the dialogue system

Start the Rasa actions server

``
rasa run actions
``

Start the Rasa dialogue manager

``
rasa run --enable-api --cors="*"
``

Start the dialogue system node server, if you have not done so already

``
node index.js
``

The system is now accessible on whatever port you configured.

**NOTE:** it may not be particularly meaningful to run the system prior to creating content as you can never proceed beyond providing problem ID or request help with theory (neither of which exists of course).

## Using the knowledge base system

Start the knowledge base system node server, if you have not done so already

``
node index.js
``

The system is now accessible on whatever port you configured (NOTE: it may).

**NOTE:** course modules must be created manually prior to adding any content in the form of problems or theory texts. There are many ways to work with the graph (neo4j-desktop, cypher-shell etc.). Then simply add modules with their name and number, like so:

```
CREATE (:Module {name: "module_name", number: module_number})
```

The module will then be available in the drop down list in the knowledge base client during content creation.

