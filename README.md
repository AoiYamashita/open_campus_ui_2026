# UI in open campus 2026
## build
```
docker build -t my-apache2 .
```
## run
```
docker run -dit --name my-running-app -p 8080:80 my-apache2
```

check [localhost](localhost:8080/sample.html)