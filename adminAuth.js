const admin = require('firebase-admin');


function checkAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).send('Unauthorized: No ID token provided');
  }

  const idToken = authHeader.split('Bearer ')[1]; // Extract the token

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      if (decodedToken.admin === true) {
        next();
      } else {
        return res.status(403).send('Unauthorized: User is not an admin');
      }
    })
    .catch((error) => {
      console.error('Error verifying ID token:', error);
      return res.status(403).send('Unauthorized');
    });
}

module.exports = checkAdmin;
