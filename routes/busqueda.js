var express = require('express')
var router = express.Router()
const axios = require('axios')
const xml2js = require('xml2js')

router.get('/', async function(req, res, next) {
  //Verifica que el valor de busqueda no venga vacio
  if (!req.query.q || (req.query.q && req.query.q.trim() === '')) return res.json({'error': 'Valor de busqueda no ingresado'}).status(400)
  const nombreBuscado = req.query.q

  //Verifica si se eligieron categorias especificas para buscar
  let categoriasSeleccionadas = null
  if (req.query.categorias && req.query.categorias.trim() !== '') categoriasSeleccionadas = req.query.categorias.split(',')

  //Crea la estructura inicial del objeto que se va a retornar
  const resultadosFinales = {
    'canciones': {
      'resultados': [],
      'origen': 'https://itunes.apple.com/search'
    },
    'peliculas': {
      'resultados': [],
      'origen': 'https://itunes.apple.com/search'
    },
    'showsTV': {
      'resultados': [],
      'origen': 'https://api.tvmaze.com/search/shows'
    },
    'personas': {
      'resultados': [],
      'origen': 'http://www.crcind.com'
    }
  }

  if (!categoriasSeleccionadas || categoriasSeleccionadas.includes('canciones')) {
    /* Busqueda de canciones */
    let response = await axios.get('https://itunes.apple.com/search?term=' + encodeURI(nombreBuscado).replace('%20', '+') + '&media=music&entity=')

    if (response.status === 200) {
      const resultados = response.data.results
      
      resultados.forEach(element => {
        let cancion = {
          'nombre': element.trackName,
          'artista': element.artistName,
          'genero': element.primaryGenreName,
          'fechaLanzamiento': new Date(element.releaseDate)
        }

        resultadosFinales.canciones.resultados.push(cancion)  
      })
    }
  }

  if (!categoriasSeleccionadas || categoriasSeleccionadas.includes('peliculas')) {
    /* Busqueda de peliculas */
    response = await axios.get('https://itunes.apple.com/search?term=' + encodeURI(nombreBuscado).replace('%20', '+') + '&media=movie')
    
    if (response.status === 200) {
      const resultados = response.data.results

      resultados.forEach(element => {
        let pelicula = {
          'nombre': element.trackName,
          'artista': element.artistName,
          'genero': element.primaryGenreName,
          'descripcion': element.longDescription,
          'fechaLanzamiento': new Date(element.releaseDate)
        }

        resultadosFinales.peliculas.resultados.push(pelicula)  
      })
    }
  }

  if (!categoriasSeleccionadas || categoriasSeleccionadas.includes('showsTV')) {
    /* Busqueda de shows de tv */
    response = await axios.get('https://api.tvmaze.com/search/shows?q=' + encodeURI(nombreBuscado))
    
    if (response.status === 200) {
      const resultados = response.data

      resultados.forEach(element => {
        let tvShow = {
          'nombre': element.show.name,
          'generos': element.show.genres,
          'descripcion': element.show.summary,
          'lenguaje': element.show.language,
          'fechaLanzamiento': new Date(element.show.premiered),
          'fechaFinalizacion': new Date(element.show.ended)
        }

        resultadosFinales.showsTV.resultados.push(tvShow)  
      })
    }
  }

  if (!categoriasSeleccionadas || categoriasSeleccionadas.includes('personas')) {
    /* Busqueda de personas */

    //Busqueda inicial. Busca las personas que su nombre coincida con la busqueda
    response = await axios.get('http://www.crcind.com/csp/samples/SOAP.Demo.cls?soap_method=GetListByName&name=' + encodeURI(nombreBuscado))

    //Se convierte lo recibido a json, ya que vienen en XML
    const jsonDatos = await xml2js.parseStringPromise(response.data)

    //Se verifica que si se encontraron valores. Los valores se encuentran hasta el objeto "GetListByNameResult"
    if (jsonDatos['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0].GetListByNameResponse[0].GetListByNameResult) {
      const resultados = jsonDatos['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0].GetListByNameResponse[0].GetListByNameResult[0].PersonIdentification

      //Se recorre cada una de las personas encontradas
      for (let i = 0; i < resultados.length; i++) {
        //Busca el resto de datos de la persona. El servicio FindPerson, recibe el id de la persona y muestra muchos mas datos de la persona
        const datosPersona = await axios.get('http://www.crcind.com/csp/samples/SOAP.Demo.cls?soap_method=FindPerson&id=' + resultados[i].ID[0])

        const jsonDatosPersona = await xml2js.parseStringPromise(datosPersona.data)
        //Se verifica que si se encontraron valores. Los valores se encuentran hasta el objeto "FindPersonResult"
        if (jsonDatosPersona['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0].FindPersonResponse[0].FindPersonResult) {
          const resultado = jsonDatosPersona['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0].FindPersonResponse[0].FindPersonResult[0]

          const persona = {
            'nombre': resultado.Name[0],
            'fechaNacimiento': new Date(resultado.DOB[0]),
            'coloresFavoritos': resultado.FavoriteColors ? resultado.FavoriteColors[0].FavoriteColorsItem : null,
            'edad': resultado.Age ? resultado.Age[0] : null,
            'titulo': resultado.Title ? resultado.Title[0] : null,
            'salario': resultado.Salary ? resultado.Salary[0] : null,
            'ubicacionCasa': resultado.Home ? {
              'Street': resultado.Home[0].Street[0],
              'City': resultado.Home[0].City[0],
              'State': resultado.Home[0].State[0],
              'Zip': resultado.Home[0].Zip[0]
            } : null,
            'ubicacionOficina': resultado.Office ? {
              'Street': resultado.Office[0].Street[0],
              'City': resultado.Office[0].City[0],
              'State': resultado.Office[0].State[0],
              'Zip': resultado.Office[0].Zip[0]
            } : null,
            'conyugue': resultado.Spouse ? {
              'nombre': resultado.Spouse[0].Name[0],
              'fechaNacimiento': resultado.Spouse[0].DOB[0],
              'edad': resultado.Spouse[0].Age ? resultado.Spouse[0].Age[0] : null
            } : null
          }

          resultadosFinales.personas.resultados.push(persona)
        }
      }
    }
  }

  return res.json(resultadosFinales)
})

module.exports = router;
