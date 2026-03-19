提取字体文件子集，在`chars.txt`中写入需要提取的文字

```
pip install fonttools
fonttools subset --text-file="chars.txt" --output-file="normal.otf" SourceHanSansSC-Normal.otf
```
