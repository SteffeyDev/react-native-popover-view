const fs = require('fs')
if (fs.existsSync('../react-navigation')) {
  console.log("React-navigation included in project")
  fs.rename('./src/index.js', './src/index-no-rn.js', err => {
    if (!err)
      fs.rename('./src/index-rn.js', './src/index.js', err => {
        if (err) console.error(err)
      })
    else
      console.error(err)
  })
}
