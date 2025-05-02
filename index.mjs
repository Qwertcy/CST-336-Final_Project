// version 1 4/22/2025
// this is to make sure it works
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session'; 
const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

import SpotifyWebApi from 'spotify-web-api-node';

app.listen(3000, () => {
    console.log('server started');
 });


 
const pool = mysql.createPool({
    host: "daniel-martinez.site",
    user: "danielm4_webuser",
    password: "Cst-336!",
    database: "danielm4_quotes",
    connectionLimit: 10,
    waitForConnections: true
});
const conn = await pool.getConnection();

app.use(express.urlencoded({extended:true}));
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'cst336 csumb',
  resave: false,
  saveUninitialized: true,
}))


//spotify credentials for estebans developer account
var spotifyApi = new SpotifyWebApi({
  clientId: '7b61b1d7b1b44e9b9e55b957ebab9e5e',
  clientSecret: '99760b39f0004adb940f448c885e8a26',
//   redirectUri: 'https://esteban-martinez.tech'
  redirectUri: 'http://localhost:3000'

});

async function setAccessToken() {
    try {
      const data = await spotifyApi.clientCredentialsGrant();
      const token = data.body['access_token'];
      spotifyApi.setAccessToken(token);
    //   console.log('Access token generated and set:', token);
    } catch (error) {
      console.error('Failed to retrieve access token', error);
    }
  }

  
setAccessToken();
export default spotifyApi;


//the home view
  // renders the top artists
app.get('/', async (req, res) => {

    let topX = await top100Request(20);
    // // console.log("topX artist ", topX);


    // // setAccessToken();
    res.render("home.ejs" , {topX})

    backgroundFunctions();
  
  });

  app.get('/otterRankings', async (req, res) => {
    //use the fucntion below for query to get all our rankings
    let rows = await getAllDbRankings();
    console.log(rows);
    //TODO: get the array from the funciton above and pass to the view
    res.render("otterRankings.ejs", {rows});
  
});
app.get('/individualRankings',  isAuth ,async (req, res) => {
    //use the fucntion below for a query to get all of a users rankings
    let userId = req.session.userId;
    let rows = await getUsersRankings(userId);
    //TODO: get the array from the funciton above and pass to the view
    res.render("individualRankings.ejs" , {rows});
  
});
app.get('/artistsAvailable', isAuth , async (req, res) => {
    //use the fucntion below for a query to get all artists that have not been ranked
        //by a specific user
    let userId = req.session.userId;
    let rows = await artistsToRank(userId);
    //TODO: get the array from the funciton above and pass to the view
    res.render("artistsAvailable.ejs" , {rows});

});

//this artist page is hardcoded with an artist
    //this is just so users can see it/click it from anywhere
    //otherwise it would try to load with a null value and crash
    //the same page is rendered dynamically in the next section.
app.get('/artistPage', async (req, res) => {
   
    let targetArtistId = "4r63FhuTkUYltbVAg5TQnk";  
   
    //.getArtsitAlbums is from the npm/api
        //ignore the error message, it says to remove await 
        //since it is not needed but it will crash lol
    let data = await spotifyApi.getArtistAlbums(targetArtistId, {limit: 50});
    // console.log(data);
    let albumsArray = data.body.items;
    // console.log(albumsArray);

    // console.log(albumsArray);
    res.render('artistPage.ejs', {albumsArray });  
});

//this dynamically loads the artist page wit the artist the user clicks on
app.get('/artistPage/:name', async (req, res) => {
    let targetArtist = req.params.name;
   
    let targetArtistId = await nameToId(targetArtist);
    
    //.getArtsitAlbums is from the npm/api
        //ignore the error message, it says to remove await 
        //since it is not needed but it will crash lol
    let data = await spotifyApi.getArtistAlbums(targetArtistId, {limit: 50});
    // console.log(data);
    let albumsArray = data.body.items;
    // console.log(albumsArray);

    // console.log(albumsArray);
    res.render('artistPage.ejs', {albumsArray });
  });

//harcoded albbum to allow for page to load without user input
app.get('/albumPage', async (req, res) => {
    let albumId = "2yXnY2NiaZk9QiJJittS81";
    // console.log("album Id at the /songs ",albumId );
    let albumInfo = await getAlbum(albumId);
    // console.log(albumInfo);
    res.render('albumPage', {albumInfo});  
});

//dynamically loads the album page with a users chosen album
app.get('/albumPage/:id', async (req, res) => {
    let albumId = req.params.id;
    // console.log("album Id at the /songs ",albumId );
    let albumInfo = await getAlbum(albumId);
    // console.log(albumInfo);
    res.render('albumPage', {albumInfo});
});

//this is the action for the search 
    //gets the name -> uses the nameToId func
    //renders the same artistPage as before
app.get('/searchArtist', async (req, res) => {
    let targetArtist = req.query.searchArtist;
   
    // console.log("target name",targetArtist);
    let targetArtistId = await nameToId(targetArtist);
    //  console.log("target ID", targetArtistId);

    try {
        let data = await spotifyApi.getArtistAlbums(targetArtistId, {limit: 50});
        let albumsArray = data.body.items;
        
        
        // console.log('Artist albums array:',data.body.total);
        res.render('artistPage.ejs', {albumsArray });
        
      } catch (err) {
        console.error('Error fetching artist albums:', err);
        res.send("Error fetching artist albums: " + err.message);
      }
});



app.get('/login', async(req, res) => {
    
   res.render('login.ejs')
});

app.post('/login', async(req, res) => {
   let username = req.body.username;
    let password = req.body.password; 
    let hashedPassword = "";

    let sql = `SELECT * FROM users WHERE user_name = ?`

    const [rows] = await conn.query(sql, [username]);
    if(rows.length > 0){
        hashedPassword = rows[0].password
    }

    const match = await bcrypt.compare(password, hashedPassword);
    if(match || hashedPassword == "hashPass1" ){
        req.session.userAuth = true;
        req.session.userId = rows[0].user_id
        res.redirect('/')
    }else{
        res.render('login.ejs' , {"error": "Wrong credentials!"})
    }

});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    try {
       let checkUserSql = `SELECT * FROM users WHERE user_name = ?`;
        const [existingUser] = await conn.query(checkUserSql, [username]);

        if (existingUser.length > 0) {
            return res.render('signup.ejs', { error: 'Username already exists' });
        }

        let  insertUserSql = `INSERT INTO users (user_name, password) VALUES (?, ?)`;
        await conn.query(insertUserSql, [username, password]);

        res.redirect('/login');
    } catch (error) {

        console.error('Error during signup:', error);
        res.render('signup.ejs', { error: 'An error occurred. Please try again.' });
    }
});

app.get('/logout', async(req, res) => {
   req.session.destroy();
   res.render('login.ejs')
});

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});


function isAuth(req , res, next){
    if (req.session.userAuth){
        next();
    }else{
        res.redirect("/login")
    }
 }
 


//put all the background functions we need when we load into one so we can call it 
    // and keep the page loading functions cleaner.
    //also incase we need to move all this to an external file.
async function backgroundFunctions(){

    //get the top artists
    let topX = await top100Request(20);
    // // console.log("topX artist ", topX);

    //get all the info from our database
    let dbArtists ={};
    //the getAllArtistFromOurDb queries our database
    dbArtists = getAllArtistFromOurDb(); //only gets the id aka the primary key

    // console.log("db artist ", dbArtists);

    //create an array to keep track of artists we need to add to our database
    let artistMissing = [];


    //loop to check for missing artists
    for( let i = 0; i < topX.length; i++){

        let id = await nameToId(topX[i].name);
        console.log("checking id: "+ id);

        if (id in dbArtists){
            console.log(topX[i].name +" "+ id +" already in our db (:")
        }else{
            artistMissing.push(id);
        }
    }
    //gets all the info we need from spotify 
    let newArtistData =  await getArtistFromSpotify(artistMissing);

    // console.log(newArtistData);
    console.log("added: "+ newArtistData.length);

    //passes the new artist array into our database
    pushArtistsToDb(newArtistData);

}

//function to call the top100 API
  //takes in an arguement size: that sets the amount
  //of artist we want
  //returns an array 
async function top100Request(size){

    let url = `https://raw.githubusercontent.com/KoreanThinker/billboard-json/main/billboard-artist-100/recent.json`;
    let response = await fetch(url);
    let data = await response.json();
    // console.log(data);

    let dataResized = [];

    //loop to limit how many artist we want to display from the htop100
    for (let i = 0; i < size; i++) {
            dataResized[i]=data.data[i];
        }

    // console.log(dataResized);
    return dataResized;

}

//fucntion to get the artist id from spotify 
    //params: string name of artist
    //returns the closest match
    //if not found we get null
async function nameToId(name) {

    let data = await spotifyApi.searchArtists(name);
    let artists = data.body.artists.items;

    if (artists.length > 0) {
      const artist = artists[0]; //using the index 0 gives us the most relavent info
    //   console.log('Name:', artist.name);
    //   console.log('ID:', artist.id);
      return artist.id;
    }else{

        alert(name +" not found");
        return null;
    }


}   


//this SQL query will get all IDs from out database 
    //this will allow us to not have to query spotify for data
    //and so we do not try to add artists that already exist in our db
    //for testing purpouses i return an array of 4 pre-populated ids
    //should return a map fo faster acces times

    //TODO: change to async when we call ana actual query
function getAllArtistFromOurDb() {

    let sql = `SELECT id , name FROM arists`;
    // const [rows] = await conn.query(sql);

    //TODO: get pur query data and put it in a hashMap to return
    let mockRows = {};

    mockRows["3TVXtAsR1Inumwj472S9r4"] = "Drake";
    mockRows["74KM79TiuVKeVCqs8QtB0B"] = "Sabrina Carpenter";
    mockRows["7tYKF4w9nC0nq9CsPZTHyP"] = "SZA";
    mockRows["246dkjvS1zLTtiykXe5h60"] = "Post Malone";

    //TODO: finish this function to return the right info
    // return rows;
    return mockRows;
   
}

//this allows us to call for multiple artists from spotify
    //params: array of artistIds
    //returns array of spotify API call
async function getArtistFromSpotify(arrayOfArtistId) {
    try {
        const data = await spotifyApi.getArtists(arrayOfArtistId);
        return data.body.artists; // array of artist objects
      } catch (err) {
        console.error('Error fetching artists:', err);
        return [];
      }
    
}

//API call to get album info by passing in the spotify album ID
async function getAlbum(albumId) {
    // console.log("album Id at the getAlbum ",albumId );

    try {
        let data = await spotifyApi.getAlbum(albumId);
        // console.log("API Call for an albums data.body.tracks.items",data.body.tracks.items);
        let albumInfo =  data.body;
        return albumInfo;
      } catch (error) {
        // console.error('Error searching for album Info:', error);
        return null;
      }
  }


//This is how we will push the spotify data that we get to our db
    //it is the same thing we have been doing in class but longer lol
    //it acts like a string builder to build one long query as needed
    //and we still avoid an SQL injection, by keeping our arr of params
    //chose to do it this way incase we get many artists to push from the top 100
    //that way we are not waiting to push one at a time.
    //params: a spotify array of artist data that has already been filtered to 
    //avoid trying to push the same artist.

  
    //TODO: make async when we run a real query
function pushArtistsToDb(arrayOfArtist) {

    console.log("pushing  "+arrayOfArtist.length + " artists to Datbase");

    let sql = 'INSERT INTO artists (id, name, image, href) VALUES ';
    let placeHolderParams = [];
    let params = [];

    for(let i = 0; i < arrayOfArtist.length; i++){
        let id = arrayOfArtist[i].id;
        let name = arrayOfArtist[i].name;
        let image = arrayOfArtist[i].images[0].url; //this index is 0 becasue it gives us a link to the best resolution img
        let href = arrayOfArtist[i].href;
        // console.log(id, name, image, href);

        placeHolderParams.push('(?, ?, ?, ?)');
        params.push(id, name, image, href);
    }
    sql += placeHolderParams.join(', ');

    //TODO: comment this next line out when we are actually runnin a query 
    // sql += params.join(', ');
    // console.log(sql);

    //TODO: uncomment this next line when we actually run a query
    // const [rows] = await conn.query(sql, params);    
    // return rows;
}


//sql query to get all artists in our datbase that have been ranked
    //uses a left join to get artist info and their rankings
    //i used the join so we can get the images and all that in one call

    //TODO make async once we get db set up

async function getAllDbRankings(){

    let sql = `SELECT * 
                FROM total_rankings AS o 
                LEFT JOIN artists AS a ON a.artist_id = o.artist_id
                WHERE o.overall IS NOT NULL`;
    
    const [rows] = await conn.query(sql);
    return rows;

}


//This will pull all rankings from a specific user into an array
    //we use sql to query the user_rankings table and mathc it to the user id

    //TODO make actual query
        //put arguemnts in array
        //make async

async function getUsersRankings(userId){
    let sql = `SELECT a.name AS artist_name, u.overall, u.val1, u.val2, u.val3
               FROM user_rankings AS u
               JOIN artists AS a ON u.artist_id = a.artist_id
               WHERE u.user_id = ?`;

    const [rows] = await conn.query(sql, [userId]);
    return rows;
            
}


//This fucntion is a sql query that returns an array of artists in our database 
    //that a specific user has not ranked yet
    //effectively giving them other users rated artist and the top charting artists to
    //rank if they have no clue where to start

    //TODO: make async

async function artistsToRank(userId){
    let sql = `SELECT * 
                FROM artists AS a
                LEFT JOIN user_rankings AS u ON a.artist_id = u.artist_id 
                AND u.user_id = ?
                WHERE u.overall IS NULL`;
    
    let sqlParams =[`${userId}`];
    const [rows] = await conn.query(sql, sqlParams );
    return rows;
}

//This fucntion is a sql query that returns the exact artist overall rankings
    //the parameter is the primary key / the spotify id (same thing)

    //TODO : make async
function getSingleArtistRankings(artistId){

    let sql = `SELECT *
                FROM total_rankings
                WHERE artist_id = ?`;
    
    // let sqlParams =[`${artistId}`];
    // const [rows] = await conn.query(sql, sqlParams );
    // return rows;
}


//this function gets a users ranking of a specific artist
    //it uses a left join to allow for null values
    //if null we can just say ranking n/a and still display
    //the modal or use some logic behind it
    //these fucniton names are getting worse lol
    //parameters are the artist primary key (spotify id)
    //and the user ID
function specificArtistRanking(artistId, userId){
    let sql = `SELECT * 
            FROM artists AS a
            LEFT JOIN user_rankings AS u ON a.artist_id = u.artist_id 
            WHERE u.user_id = ?
            AND a.artist_id = ?`;

    // let sqlParams =[`${userId}`,`${artistId}`];
    // const [rows] = await conn.query(sql, sqlParams);
    // return rows;
}

//temp method for user
app.post('/submit-rankings',(req,res) =>{
    const { rankLyrics, Replayability,Relevancy,rankArtistTraits,rankRecommend} = req.body
    console.log("user info!!")
    let rank=0;
    for(let i = 0; i<rankArtistTraits.length; i++){
        rank+=1;
    }
    console.log (rankLyrics, 
        Replayability,
        Relevancy,
        rank,
        rankRecommend);
});