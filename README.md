![HDFWeb Logo](http://i.imgur.com/6mlZGk6.jpg)

#HDFWeb Specification
This document describes HDFWeb, a system designed to allow remote viewing of raster images stored in the HDF5 file format in-browser. 

This software is pre-alpha, so this document is subject to change.

##Purpose

One of NEMALOAD's goals is to generate public interest in science through openness. There are a number of factors which make it very difficult for the general public to view the processed data we generate at the moment, such as prohibitive size, uncommon data formats, and custom software which is difficult to build. To facilitate delivering visualizations to the public, we are writing HDFView.

HDFView is a work that will continue to grow as the project does. While the first release of the software will only support viewing raw microscope images and videos, features which will be added in later releases include support for GLSL shaders for raytracing, as well as 3D visualizations of tomographic data. This will allow unprecedented public access to the data.

##Design Overview

All data is backed up and stored for internal distribution on S3. From there, the web server keeps in sync via the _s3cmd sync_ tool. The webserver consists of three parts:

* The file daemon retrieves file information, performs necessary file conversions, updates the database, and pulls new files from S3 when necessary.
	
* The web server program provides resource information stored in the database via a RESTful API. 
	
* A fast reverse proxy, such as nginx, provides access to the PNGs stored on the server.
	
The client software is written in Javascript and WebGL. It consists of:
	
* An UI in which the user can browse files, see file details, and proceed with visualization.
	
* HTML5 Cache in which the large images are stored.
	
* WebGL shaders written in GLSL which process the data and provide interactivity.


![HDFWeb Design Draft](http://i.imgur.com/YKpCdZk.png)

##API

### Notes

The only verb that the client will utilize is GET. POST, PUT, and DELETE will be used by the server file daemon to maintain the database, and as such, access should be restricted.

### Resources


#### Collections
Collections consist of one or more HDF5 files.
* GET collections
	* Returns all names and IDs of collections on the server.

```GET collections```
```json
{
   "collections":[
      {
         "name":"worms",
         "id":"5sa35gbmle"
      },
      {
         "name":"flies",
         "id":"2za32gb5el"
      }
   ]
}
```

* GET collections/:id
	* Returns a list of all files and file IDs in the specified collection

```GET collections/2za32gb5el```	
```json
{
   "files":[
      {
         "name":"Epi_63xZeiss_1.4_3beads_w_lenses1.hdf5",
         "id":"AofWKYWz6Q"
      },
      {
         "name":"Kohler_63xZeiss_1.4_pollen_wo_lenses.hdf5",
         "id":"GiELmFmpdZ"
      }
   ]
}
```

* POST collections
	* Creates a new collection with the specified name.
* PUT collections/:id
	* Updates the specified collection by adding files through their id.
* DELETE collections/:id
	* Deletes the specified collection.

#### Files

Files consist of one or more groups. They also have non-HDF5 related properties such as size and modification date.
* GET files
	* Get a list of all files

```GET files```
```json

{
    "files":[{
            "name": "Epi_63xZeiss_1.4_3beads_w_lenses1.hdf5",
            "id": "AofWKYWz6Q"
        }, {
            "name": "Kohler_63xZeiss_1.4_pollen_wo_lenses.tif",
            "id": "GiELmFmpdZ"
        }, {
            "name": "MT21063_video11.hdf5",
            "id": "66vd2RGEXm"
    }]

}
```
* GET files/:id
	* Get the metadata of the given file

``` GET files/66vd2RGEXm```
```json
{
   "metadata":[
      {
         "name":"MT21063_video11.hdf5",
         "size":2367970585,
         "modified":"2003-08-04 12:30:45",
         "path":"/this/is/not/secure/so/needs/authentication/at/some/point",
         "groups":[
            {
               "name":"frames",
               "id":"CkaRvZe3A5"
            }
         ]
      }
   ]
}
```
* POST files
	* Registers a file in the database from it's path on the machine.
* PUT files/:id
	* Queues an update of that file's data by the maintenance script
* DELETE files/:id
	* Deletes a file from the database(stays on local machine)

#### Groups

Groups consist of one or more datasets, each representing an image frame in the current use case.

* GET groups/:id
	* Get the HDF5 metadata of the given group.

```GET groups/CkaRvZe3A5```
```json
{
   "metadata":[
      {
         "name":"frames",
         "size":1,
         "attributes":[
            {
               "createdAt":[
                  {
                     "value":"2013-05-25 04:01:45",
                     "type":"String, length=19",
                     "size":1
                  }
               ]
            },
            {
               "numFrames":[
                  {
                     "value":1,
                     "type":"64-bit integer",
                     "size":1
                  }
               ]
            },
            {
               "originalName":[
                  {
                     "value":"Epi_63xZeiss_1.4_3beads_w_lenses1.hdf5",
                     "type":"String, length=33",
                     "size":1
                  }
               ]
            }
         ]
      }
   ]
}
```
* POST groups
	* Adds a group
* PUT groups/:id
	* Updates a group
* DELETE groups/:id
	* Removes a group

#### Datasets

Datasets are multidimensional arrays containing grayscale image data. These correspond to image frames. These also may contain metadata.
* GET datasets/metadata
	* Returns metadata information on all datasets
* GET datasets/metadata/:id
	* Returns the metadata of the given dataset.
* GET datasets/data/:id
	* Returns the link to the  PNG representation of the given dataset
* POST datasets
	* Adds a dataset
* PUT datasets/:id
	* Edits a dataset
* DELETE datasets/:id
	* Deletes a dataset


## Implementation Notes

For the client side, Backbone.js will be utilized for large portions of the UI. While the server will be eventually written in OpenResty for speed, due to lack of experience with that web framework portions of the infrastructure will be written in server-side Javascript and then ported to OpenResty to save time and confusion. The server-daemon will be written in a fast scripting language, probably Go, due to the amount of related utility code NEMALOAD has written.

## Licensing
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.
