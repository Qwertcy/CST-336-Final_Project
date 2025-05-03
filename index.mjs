// version 1 4/22/2025
//test este
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session'; 
const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

import SpotifyWebApi from 'spotify-web-api-node';


 
// const pool = mysql.createPool({
//     host: "daniel-martinez.site",
//     user: "danielm4_webuser",
//     password: "Cst-336!",
//     database: "danielm4_quotes",
//     connectionLimit: 10,
//     waitForConnections: true
// });
// const conn = await pool.getConnection();

//setting up database connection pool
const pool = mysql.createPool({
    host: "esteban-martinez.tech",
    user: "estebanm_webuser",
    password: "Team5rocks",
    database: "estebanm_otter_rankings",
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



app.use(express.json());

app.listen(3000, () => {
    console.log('server started');
 });



//the home view
  // renders the top artists
app.get('/', async (req, res) => {

    let topX = await top100Request(27);
    // // console.log("topX artist ", topX);


    // // setAccessToken();
    res.render("home.ejs" , {topX})

    await backgroundFunctions();
  
  });

  app.get('/otterRankings', async (req, res) => {
    //use the fucntion below for query to get all our rankings
    let rows = await getOtterOrder();
    // console.log("/otterRankings");
    // console.log(rows);
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
        // let sql = `SELECT * FROM users`

      
    const [rows] = await pool.query(sql, [username]);


    console.log("USERS:");

    console.log(rows);

    if(rows.length > 0){
        hashedPassword = rows[0].password
    }

    // const match = await bcrypt.compare(password, hashedPassword);
    const match  =( password === hashedPassword)
    if(match  ){
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
        const [existingUser] = await pool.query(checkUserSql, [username]);

        if (existingUser.length > 0) {
            return res.render('signup.ejs', { error: 'Username already exists' });
        }

        let  insertUserSql = `INSERT INTO users (user_name, password) VALUES (?, ?)`;
        await pool.query(insertUserSql, [username, password]);

        res.redirect('/login');
    } catch (error) {

        console.error('Error during signup:', error);
        res.render('signup.ejs', { error: 'An error occurred. Please try again.' });
    }
});

app.post('/submitRankings', async  (req, res) => {
    // const ranks = req.body.ranks; 
    const ranks = req.body.ranks.map(Number); 

    const name =  req.body.artistName;
    console.log("Received:", ranks, name );


    let userId = req.session.userId;
    let artistId = await nameToId(name)

    let checkSql = `SELECT 1 FROM artists WHERE artist_id = ?`;
    const [checkRows] = await pool.query(checkSql, [artistId]);

    if (checkRows.length === 0) {
    
        const [artistData] = await getArtistFromSpotify([artistId]);
    
        if (artistData) {
            await pushArtistsToDb([artistData]);
        } else {
            console.error("Artist data not found from Spotify.");
        }
    }




    let userRankings = await specificArtistRanking( userId, artistId);

    if (userRankings.length < 1){
        console.log("No rankings found.");

        //push the ranking 
        await updateTotalRanking(userId, artistId, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4])
        await addUserRanking(artistId, userId, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]);

      } else {

        //delete the ranking and push 
        await updateTotalRanking(userId, artistId, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4])
        await deleteUserRanking(artistId, userId);
        await addUserRanking(artistId, userId, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]);


      }

    
      
      res.redirect('/individualRankings');

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
    let topX = await top100Request(25);
    // // console.log("topX artist ", topX);

    //get all the info from our database
    let dbArtists ={};
    //the getAllArtistFromOurDb queries our database
    dbArtists = await getAllArtistFromOurDb(); //only gets the id aka the primary key

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

    if (artistMissing.length > 0 ) {
        let newArtistData =  await getArtistFromSpotify(artistMissing);

        // console.log(newArtistData);
        console.log("added: "+ newArtistData.length);
    
        //passes the new artist array into our database
        await pushArtistsToDb(newArtistData);
    
    }

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

        console.warn("Artist not found:", name);
        return null;
    }


}   


//this SQL query will get all IDs from out database 
    //this will allow us to not have to query spotify for data
    //and so we do not try to add artists that already exist in our db
    //for testing purpouses i return an array of 4 pre-populated ids
    //should return a map fo faster acces times

    //TODO: change to async when we call ana actual query
async function getAllArtistFromOurDb() {

    let sql = `SELECT artist_id , name FROM artists`;
    const [rows] = await pool.query(sql);
    console.log(rows);
    console.log('getAllArtistFromOurDb');

    //TODO: get pur query data and put it in a hashMap to return
    // let mockRows = {};
    let artistMap = {};


    // mockRows["3TVXtAsR1Inumwj472S9r4"] = "Drake";
    // mockRows["74KM79TiuVKeVCqs8QtB0B"] = "Sabrina Carpenter";
    // mockRows["7tYKF4w9nC0nq9CsPZTHyP"] = "SZA";
    // mockRows["246dkjvS1zLTtiykXe5h60"] = "Post Malone";

    //TODO: finish this function to return the right info
    // return rows;

    for (let i = 0; i < rows.length; i++) {
        const id = rows[i].artist_id;
        const name = rows[i].name;
        artistMap[id] = name;
    }

    return artistMap;
   
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
async function pushArtistsToDb(arrayOfArtist) {

    console.log("pushing  "+arrayOfArtist.length + " artists to Datbase");

    let sql = 'INSERT INTO artists (artist_id, name, image, href) VALUES ';
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

    // TODO: uncomment this next line when we actually run a query
    const [rows] = await pool.query(sql, params);    
    return rows;
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
    
    const [rows] = await pool.query(sql);
    // console.log("getAllDbRankings");
    // console.log(rows);
    return rows;

}
async function getOtterOrder(){

    let sql = `SELECT * 
                FROM total_rankings AS o 
                LEFT JOIN artists AS a ON a.artist_id = o.artist_id
                WHERE o.overall IS NOT NULL
                ORDER BY  o.overall DESC `;
    
    const [rows] = await pool.query(sql);
    // console.log("getAllDbRankings");
    // console.log(rows);
    return rows;

}


//This will pull all rankings from a specific user into an array
    //we use sql to query the user_rankings table and mathc it to the user id

    //TODO make actual query
        //put arguemnts in array
        //make async

async function getUsersRankings(userId){
    let sql = `SELECT a.name AS artist_name, u.overall, u.val1, u.val2, u.val3, u.val4, u.val5
               FROM user_rankings AS u
               JOIN artists AS a ON u.artist_id = a.artist_id
               WHERE u.user_id = ?
               ORDER BY u.overall DESC`;


 
    const [rows] = await pool.query(sql, [userId]);

    // console.log("getUsersRankings");
    // console.log(rows)

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

                // let sql = `SELECT * 
                //             FROM artists AS a
                //             LEFT JOIN user_rankings AS u 
                //             ON a.artist_id = u.artist_id AND u.user_id = ?
                //             WHERE u.user_id IS NULL;`;

    
    let sqlParams =[`${userId}`];
    const [rows] = await pool.query(sql, sqlParams );
    return rows;
    // const [rows] = await conn.query(sql, [userId] );

    // console.log("artistsToRank");
    // console.log(rows)
}

//This fucntion is a sql query that returns the exact artist overall rankings
    //the parameter is the primary key / the spotify id (same thing)

    //TODO : make async
async function getSingleArtistRankings(artistId){

    let sql = `SELECT *
                FROM total_rankings
                WHERE artist_id = ?`;
    
    let sqlParams =[`${artistId}`];
    const [rows] = await pool.query(sql, sqlParams );
    return rows;
}


//this function gets a users ranking of a specific artist
    //it uses a left join to allow for null values
    //if null we can just say ranking n/a and still display
    //the modal or use some logic behind it
    //these fucniton names are getting worse lol
    //parameters are the artist primary key (spotify id)
    //and the user ID
async function specificArtistRanking( userId, artistId) {
  const sql = `SELECT * 
               FROM user_rankings
               WHERE user_id = ? AND artist_id = ?`;

  const sqlParams = [userId, artistId];
  const [rows] = await pool.query(sql, sqlParams);
  return rows;
}


async function deleteUserRanking(artistId, userId) {
    const sql = `DELETE FROM user_rankings 
                 WHERE artist_id = ? AND user_id = ?`;
    const sqlParams = [artistId, userId];
    await pool.query(sql, sqlParams);

  }
  

  async function addUserRanking(artistId, userId, val1, val2, val3, val4, val5) {

    let overall = (val1+ val2+ val3+ val4+ val5) / 5 ;

    const sql = `INSERT INTO user_rankings 
                 (artist_id, user_id, overall, val1, val2, val3, val4, val5)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
    const sqlParams = [artistId, userId, overall, val1, val2, val3, val4, val5];
    await pool.query(sql, sqlParams);
  }
  

  async function getUserRawRankings(userId, artistId) {

    const sql = `SELECT artist_id, overall, val1, val2, val3, val4, val5
                 FROM user_rankings
                 WHERE user_id = ? AND artist_id = ?`;
  
    const [rows] = await pool.query(sql, [userId, artistId]);
  
    return rows;
  }

  async function getTotalArtistRankings(artistId) {

    const sql = `SELECT artist_id, times_ranked, overall, val1, val2, val3, val4, val5
                 FROM total_rankings
                 WHERE artist_id = ?`;
  
    const [rows] = await pool.query(sql, [artistId]);
    return rows;
  }





async function updateTotalRanking(userId, artistId, val1, val2, val3, val4, val5) {

    let currentRating = await getUserRawRankings(userId, artistId); // users current rating
    let currTotals = await getTotalArtistRankings(artistId); // totals

    if (currTotals.length < 1) {
        await pool.query(
            `INSERT INTO total_rankings (artist_id, times_ranked, overall, val1, val2, val3, val4, val5)
             VALUES (?, 0, 0, 0, 0, 0, 0, 0)`, [artistId]
        );
        currTotals = await getTotalArtistRankings(artistId);
    }

  
    if (currentRating.length < 1) {
        let timesRanked = currTotals[0].times_ranked ?? 0;
    
        let val_1 = currTotals[0].val1 ?? 0;
        let val_2 = currTotals[0].val2 ?? 0;
        let val_3 = currTotals[0].val3 ?? 0;
        let val_4 = currTotals[0].val4 ?? 0;
        let val_5 = currTotals[0].val5 ?? 0;
    
        let new1 = (val_1 * timesRanked) + val1;
        let new2 = (val_2 * timesRanked) + val2;
        let new3 = (val_3 * timesRanked) + val3;
        let new4 = (val_4 * timesRanked) + val4;
        let new5 = (val_5 * timesRanked) + val5;
    
        timesRanked += 1;
    
        let newVal1 = new1 / timesRanked;
        let newVal2 = new2 / timesRanked;
        let newVal3 = new3 / timesRanked;
        let newVal4 = new4 / timesRanked;
        let newVal5 = new5 / timesRanked;
        let newOverall = (newVal1 + newVal2 + newVal3 + newVal4 + newVal5) / 5;
    
        await updateTotalDb(artistId, timesRanked, newOverall, newVal1, newVal2, newVal3, newVal4, newVal5);
    } else {
      // Updating existing rating
      let timesRanked = currTotals[0].times_ranked;
  
      let old = currentRating[0];
  
      let total1 = currTotals[0].val1 * timesRanked;
      let total2 = currTotals[0].val2 * timesRanked;
      let total3 = currTotals[0].val3 * timesRanked;
      let total4 = currTotals[0].val4 * timesRanked;
      let total5 = currTotals[0].val5 * timesRanked;
  
      // Subtract the old rating values
      total1 -= old.val1;
      total2 -= old.val2;
      total3 -= old.val3;
      total4 -= old.val4;
      total5 -= old.val5;
  
      // Add new values
      total1 += val1;
      total2 += val2;
      total3 += val3;
      total4 += val4;
      total5 += val5;
  
      // Re-average
      let newVal1 = total1 / timesRanked;
      let newVal2 = total2 / timesRanked;
      let newVal3 = total3 / timesRanked;
      let newVal4 = total4 / timesRanked;
      let newVal5 = total5 / timesRanked;
      let newOverall = (newVal1 + newVal2 + newVal3 + newVal4 + newVal5) / 5;
  
      await updateTotalDb(artistId, timesRanked, newOverall, newVal1, newVal2, newVal3, newVal4, newVal5);
    }


  }
  

  async function updateTotalDb(artistId, timesRanked, overall, val1, val2, val3, val4, val5) {
    const sql = `
      UPDATE total_rankings
      SET times_ranked = ?, overall = ?, val1 = ?, val2 = ?, val3 = ?, val4 = ?, val5 = ?
      WHERE artist_id = ?
    `;
  
    const params = [timesRanked, overall, val1, val2, val3, val4, val5, artistId];
  
      await pool.query(sql, params);

  }
  