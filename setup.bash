echo start build
docker build -t open-campus-2026-ui .
echo run container
docker run -dit --name ui-app --net host open-campus-2026-ui
